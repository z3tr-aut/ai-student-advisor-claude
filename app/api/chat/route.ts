import { NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { advisorTools, runAdvisorTool } from "@/lib/advisor/chat-tools";

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
    "You are the AI Student Advisor for the IT Faculty at Aqaba University of Technology.",
    "Help students choose courses, understand prerequisites, and plan their next semester. Answer in the student's language (Arabic or English) matching the question.",
    "Style: calm, precise, short paragraphs. When recommending courses, prefer a brief numbered list.",
    "When the student asks what to register for, what they can take next semester, which courses are available, or anything about scheduling their coursework — you MUST call the `recommend_courses` tool with their target credit load (default 15) instead of guessing.",
    "After the tool returns, read the JSON, and present the picks as a bullet list with the course code, Arabic name, and credit hours. Mention any warnings. If the tool returns an error, explain it to the student and suggest the onboarding step if relevant.",
    "For non-scheduling questions (majors, careers, general advice), answer from your own knowledge using the student profile below.",
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

  // Check rate limit before doing anything expensive (persisted in Supabase)
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

  // Limit message length to prevent prompt injection / abuse
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
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const geminiModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: advisorTools }],
  });

  const history: Content[] = messages
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
      const toolTraces: Array<{ tool: string; args: unknown; result: unknown }> = [];
      try {
        const chat = geminiModel.startChat({ history });

        // Tool-calling loop: keep feeding function responses back until the model stops asking.
        let nextMessage: string | Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> =
          latestUserMsg.content;
        for (let turn = 0; turn < 4; turn++) {
          const result = await chat.sendMessage(nextMessage as string); // (also accepts parts[])
          const response = result.response;
          const calls = response.functionCalls?.() ?? [];

          if (calls.length === 0) {
            const text = response.text();
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
            break;
          }

          // Run all calls, collect the function responses
          const responses = await Promise.all(
            calls.map(async (call) => {
              const payload = await runAdvisorTool(call.name, call.args as Record<string, unknown>, supabase, user.id);
              toolTraces.push({ tool: call.name, args: call.args, result: payload });
              return {
                functionResponse: {
                  name: call.name,
                  response: payload,
                },
              };
            })
          );
          // Emit a breadcrumb so the client can render a tool-call card
          controller.enqueue(
            encoder.encode(`\n\n[tool:${calls.map((c) => c.name).join(",")}]\n`)
          );
          nextMessage = responses as unknown as string;
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
