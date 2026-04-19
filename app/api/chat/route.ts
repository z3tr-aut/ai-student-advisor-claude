import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

  const { data: rateCheck, error: rateErr } = await supabase.rpc("check_and_increment_rate_limit", {
    p_user_id: user.id,
  });
  if (rateErr) {
    return NextResponse.json({ error: "Rate limit check failed." }, { status: 500 });
  }
  if (!rateCheck?.allowed) {
    return NextResponse.json({ error: rateCheck?.message ?? "Rate limit exceeded." }, { status: 429 });
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

  const latestUserMsg = messages[messages.length - 1];
  if (latestUserMsg?.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
  }
  if (latestUserMsg.content.length > 2000) {
    return NextResponse.json({ error: "Message too long. Please keep messages under 2000 characters." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
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

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildSystemPrompt(profile);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const geminiModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });

  // Convert history (all messages except the last user message) to Gemini format
  // Gemini uses "model" instead of "assistant"
  const history = messages
    .slice(0, -1)
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        const chat = geminiModel.startChat({ history });
        const result = await chat.sendMessageStream(latestUserMsg.content);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullText += text;
            controller.enqueue(encoder.encode(text));
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
        const msg = err instanceof Error ? err.message : "Gemini API error";
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
