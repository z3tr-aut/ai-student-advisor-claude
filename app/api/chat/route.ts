import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingMsg = { role: "user" | "assistant"; content: string };
type Profile = {
  full_name?: string | null;
  interests?: string[] | null;
  skills?: string[] | null;
  preferred_countries?: string[] | null;
  grades?: Record<string, unknown> | null;
  education_level?: string | null;
  bio?: string | null;
};

// ─── RATE LIMITING ─────────────────────────────────────
// Per user: max 10 messages per hour, max 50 per day
const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 50;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const rateLimits = new Map<string, { hourly: number[]; daily: number[] }>();

function checkRateLimit(userId: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const entry = rateLimits.get(userId) || { hourly: [], daily: [] };

  // Remove timestamps older than 1 hour / 1 day
  entry.hourly = entry.hourly.filter((t) => now - t < HOUR_MS);
  entry.daily = entry.daily.filter((t) => now - t < DAY_MS);

  if (entry.hourly.length >= HOURLY_LIMIT) {
    return { allowed: false, message: `You've reached the hourly limit of ${HOURLY_LIMIT} messages. Please try again later.` };
  }
  if (entry.daily.length >= DAILY_LIMIT) {
    return { allowed: false, message: `You've reached the daily limit of ${DAILY_LIMIT} messages. Please try again tomorrow.` };
  }

  entry.hourly.push(now);
  entry.daily.push(now);
  rateLimits.set(userId, entry);
  return { allowed: true };
}

function buildSystemPrompt(profile: Profile | null): string {
  const parts: string[] = [
    "You are the AI Student Advisor — a warm, knowledgeable guide helping students choose majors, plan careers, and find universities.",
    "Style: calm, precise, and editorial. Prefer short paragraphs over walls of text. When comparing options, use a brief numbered list (max 5 items).",
    "Always ground advice in the student's profile below when relevant. If the profile is empty, ask one focused question before recommending.",
    "When suggesting universities, note region/country and what makes each a fit. When suggesting careers, include one realistic first-step role.",
    "Never pretend to know real-time admission deadlines, tuition, or ranking numbers — instead, tell the student where to verify.",
  ];

  if (profile) {
    const snippet: string[] = [];
    if (profile.full_name) snippet.push(`Name: ${profile.full_name}`);
    if (profile.education_level) snippet.push(`Education level: ${profile.education_level}`);
    if (profile.interests?.length) snippet.push(`Interests: ${profile.interests.join(", ")}`);
    if (profile.skills?.length) snippet.push(`Skills: ${profile.skills.join(", ")}`);
    if (profile.preferred_countries?.length) snippet.push(`Preferred countries: ${profile.preferred_countries.join(", ")}`);
    if (profile.grades && Object.keys(profile.grades).length) snippet.push(`Grades: ${JSON.stringify(profile.grades)}`);
    if (profile.bio) snippet.push(`Bio: ${profile.bio}`);
    if (snippet.length) parts.push("\nSTUDENT PROFILE\n" + snippet.join("\n"));
  }
  return parts.join("\n\n");
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check rate limit before doing anything expensive
  const rateCheck = checkRateLimit(user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.message }, { status: 429 });
  }

  let body: { messages: IncomingMsg[]; sessionId: string | null; profile: Profile | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, profile } = body;
  let { sessionId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Limit message length to prevent prompt injection / abuse
  const latestUserMsg = messages[messages.length - 1];
  if (latestUserMsg?.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
  }
  if (latestUserMsg.content.length > 2000) {
    return NextResponse.json({ error: "Message too long. Please keep messages under 2000 characters." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  if (!sessionId) {
    const title = latestUserMsg.content.slice(0, 60).trim() + (latestUserMsg.content.length > 60 ? "…" : "");
    const { data: newSession, error: sessionErr } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (sessionErr || !newSession) {
      return NextResponse.json({ error: "Could not create chat session" }, { status: 500 });
    }
    sessionId = newSession.id;
  }

  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "user",
    content: latestUserMsg.content,
  });

  const anthropic = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(profile);
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  const apiMessages = messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        const response = await anthropic.messages.stream({
          model,
          max_tokens: 1500,
          system: systemPrompt,
          messages: apiMessages,
        });

        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const chunk = event.delta.text;
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        if (fullText.trim()) {
          await supabase.from("chat_messages").insert({
            session_id: sessionId!,
            user_id: user.id,
            role: "assistant",
            content: fullText,
          });
          await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId!);
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Claude API error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-session-id": sessionId!,
      "Cache-Control": "no-store",
    },
  });
}