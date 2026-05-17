import { NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { advisorTools, runAdvisorTool } from "@/lib/advisor/chat-tools";
import { buildStudentProfile, type StudentAcademicProfile } from "@/lib/advisor/fixtures";

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


function formatAcademicRecord(p: StudentAcademicProfile): string {
  const lines: string[] = [];
  lines.push("STUDENT ACADEMIC RECORD (authoritative — use this, do not ask the student to repeat it)");
  lines.push(`  Student ID: ${p.stdId}` + (p.studentName ? `  (${p.studentName})` : ""));
  lines.push(`  Major: ${p.majorName ?? "unknown"}${p.majorId ? ` (id ${p.majorId})` : ""}`);
  lines.push(`  Approximate year: ${p.approxYear} (based on credits completed; not authoritative)`);
  lines.push(`  Credits completed: ${p.creditsCompleted}`);
  lines.push(`  Courses passed: ${p.passedCount}, currently enrolled: ${p.enrolledCount}, failed: ${p.failedCount}`);
  if (p.transcript.length) {
    lines.push("  Transcript:");
    for (const t of p.transcript) {
      const grade = t.grade ? ` grade ${t.grade}` : "";
      lines.push(`    - ${t.courseId.padEnd(4)} ${t.courseName} (${t.credits}cr, ${t.status}${grade})`);
    }
  }
  return lines.join("\n");
}

function buildSystemPrompt(
  profile: Profile | null,
  academic: StudentAcademicProfile | null,
  preferredLanguage: "en" | "ar" = "en",
): string {
  const languageRule =
    preferredLanguage === "ar"
      ? "The student's interface language is set to Arabic. ALWAYS reply in Arabic unless the student explicitly writes their message in English, in which case reply in English."
      : "Match the student's language (Arabic or English). If the student writes Arabic, reply in Arabic; if English, reply in English.";
  const parts: string[] = [
    `You are an academic advisor chatting with a student at Aqaba University of Technology. Talk like a friendly tutor, not a formal report. ${languageRule}`,
    "Tone: casual, short, direct. Plain prose. Treat it like texting a friend who happens to be smart — answer the question and stop.",
    "Formatting rules — strictly follow:",
    "  - The chat renders as plain text. Do NOT use markdown: no asterisks, no **bold**, no #headings, no backticks, no `*` or `-` bullet lines for emphasis. The user literally sees the asterisks.",
    "  - When listing a few items (like courses in a schedule), put each on its own line with no leading symbol. Keep lines short.",
    "  - Default to 1–4 short sentences. Only go longer when the student explicitly asks for detail.",
    "Two tools are available for scheduling — always call one of them, never invent picks yourself:",
    "  - build_schedule — use whenever the student mentions any time-of-day preference (no class before X, no class after Y) or any day to skip, or just asks for a schedule. Pass earliest_start as HH:MM, latest_end as HH:MM, excluded_days as an array of day names (Sunday/Monday/Tuesday/Wednesday/Thursday).",
    "  - recommend_courses — use for plain 'what can I take next semester' questions with no time preference.",
    "Default target_credits to 15 if the student didn't say.",
    "After a tool returns, talk through the result naturally. For build_schedule, list each pick on its own line as: course name, day, start-end time. Briefly mention warnings or unscheduled courses if any. If the tool returned an error, just explain it in one sentence.",
    `When you mention a course by name, use the field that matches the reply language: when replying in Arabic, use 'course_name_ar' from the tool response; when replying in English, use 'course_name'. The preferred reply language is ${preferredLanguage === "ar" ? "Arabic" : "English"}.`,
    "For non-scheduling questions, answer from your own knowledge using the academic record below if it's relevant.",
    "Never make up admission deadlines, tuition, rankings — say where to verify instead.",
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

  if (academic) {
    parts.push("\n" + formatAcademicRecord(academic));
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

  // Resolve the user's interface-language preference (drives the advisor's reply
  // language). Fetched server-side so the client cannot spoof it.
  let preferredLanguage: "en" | "ar" = "en";
  try {
    const { data: prefRow } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", user.id)
      .maybeSingle();
    if (prefRow?.preferred_language === "ar") preferredLanguage = "ar";
  } catch {
    // column may not exist yet pre-migration — fall back to English silently
  }

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

  // If client supplied a sessionId, verify it belongs to this user before using it.
  // Without this check, a user could pollute another user's session storage by passing
  // someone else's session UUID. RLS would block reads but writes would succeed.
  if (sessionId) {
    const { data: ownedSession } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ownedSession) {
      sessionId = null;
    }
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

  const fixtureStdId = (user.user_metadata as { std_id?: number | string } | null | undefined)?.std_id;
  const academic = fixtureStdId !== undefined ? buildStudentProfile(fixtureStdId) : null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildSystemPrompt(profile, academic, preferredLanguage);
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

        // The SDK's response.text() / response.functionCalls() THROW when the
        // candidate finished with no usable content (MALFORMED_FUNCTION_CALL,
        // SAFETY, RECITATION, MAX_TOKENS, OTHER). Heavier "preferable schedule"
        // requests trigger that often. Never let it crash the stream.
        const safeText = (r: { text: () => string }): string => {
          try {
            return r.text() ?? "";
          } catch {
            return "";
          }
        };

        // Tool-calling loop: keep feeding function responses back until the model stops asking.
        let nextMessage: string | Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> =
          latestUserMsg.content;
        let finishReason: string | undefined;
        for (let turn = 0; turn < 4; turn++) {
          const result = await chat.sendMessage(nextMessage as string); // (also accepts parts[])
          const response = result.response;
          finishReason = response.candidates?.[0]?.finishReason as string | undefined;

          let calls: Array<{ name: string; args: Record<string, unknown> }> = [];
          try {
            calls = (response.functionCalls?.() ?? []) as Array<{
              name: string;
              args: Record<string, unknown>;
            }>;
          } catch {
            calls = [];
          }

          if (calls.length === 0) {
            const text = safeText(response);
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
            break;
          }

          // Run all calls, collect the function responses
          const responses = await Promise.all(
            calls.map(async (call) => {
              const payload = await runAdvisorTool(call.name, call.args as Record<string, unknown>, supabase, user);
              toolTraces.push({ tool: call.name, args: call.args, result: payload });
              return {
                functionResponse: {
                  name: call.name,
                  response: payload,
                },
              };
            })
          );
          nextMessage = responses as unknown as string;
        }

        // The model produced no usable text — it returned a malformed/empty
        // turn, was cut off, or kept calling tools past the cap. Degrade
        // gracefully with a recoverable message instead of throwing the
        // generic error. The tools already ran, so a rephrase will work.
        if (!fullText.trim()) {
          console.warn(
            "[/api/chat] no assistant text; finishReason=",
            finishReason,
            "tools=",
            toolTraces.map((t) => t.tool),
          );
          const fallback =
            "I couldn't put that together just now. Try rephrasing — for example: \"build a 15-credit schedule with no Thursday classes and nothing before 9 AM.\"";
          fullText = fallback;
          controller.enqueue(encoder.encode(fallback));
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
        console.error("[/api/chat] Gemini stream error:", err);
        controller.enqueue(encoder.encode("\n\n[Error: Something went wrong. Please try again.]"));
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
