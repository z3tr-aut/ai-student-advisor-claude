import { NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { advisorTools, runAdvisorTool } from "@/lib/advisor/chat-tools";
import { buildStudentProfile, type StudentAcademicProfile } from "@/lib/advisor/fixtures";
import {
  encodeSchedulePayload,
  type ScheduleMessageMetadata,
  type SchedulePick,
} from "@/lib/advisor/chat-payload";

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

function buildSystemPrompt(profile: Profile | null, academic: StudentAcademicProfile | null, lang: string = "en"): string {
  const langDirective = lang === "ar"
    ? "The student's preferred language is Arabic. ALWAYS reply in Arabic, even if the student wrote in English. Use natural, friendly Arabic — not formal MSA. Course names may come in both Arabic and English; use the Arabic name when available."
    : "The student's preferred language is English. ALWAYS reply in English, even if the student wrote in Arabic.";
  const parts: string[] = [
    `You are an academic advisor chatting with a student at Aqaba University of Technology. Talk like a friendly tutor, not a formal report. ${langDirective}`,
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
    "Schedule acceptance lives in the UI: a build_schedule result renders an Accept button next to your message — do not pretend to save anything yourself, do not invent confirmation steps, just present the picks and let the student click Accept (the UI shows its own confirmation modal). If the student says 'save it' or 'looks good', tell them to hit Accept on the schedule above.",
    "If the student asks to discard their schedule or significantly edit it (drop a course, swap a section), confirm in one short sentence first ('To confirm — you want to drop X and rebuild?') BEFORE calling build_schedule again. The destructive UI confirmation (Discard button on My Schedule) is separate from this — verbal confirmation is about not surprising them with a regenerated schedule.",
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

  let body: { messages: IncomingMsg[]; sessionId: string | null; profile: Profile | null; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, profile, lang = "en" } = body;
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

  const fixtureStdId = (user.user_metadata as { std_id?: number | string } | null | undefined)?.std_id;
  const academic = fixtureStdId !== undefined ? buildStudentProfile(fixtureStdId) : null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildSystemPrompt(profile, academic, lang);

  // Model cascade: try the preferred model first, fall back to stable alternatives on 503.
  const MODEL_CASCADE = [
    process.env.GEMINI_MODEL || "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ].filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate

  function makeModel(name: string) {
    return genAI.getGenerativeModel({
      model: name,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: advisorTools }],
    });
  }

  function is503(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("503") || msg.toLowerCase().includes("service unavailable") || msg.toLowerCase().includes("high demand");
  }

  async function sendWithRetry(
    modelName: string,
    chat: ReturnType<ReturnType<typeof genAI.getGenerativeModel>["startChat"]>,
    message: string | Array<{ functionResponse: { name: string; response: Record<string, unknown> } }>
  ) {
    const MAX_RETRIES = 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await chat.sendMessage(message as string);
      } catch (err) {
        lastErr = err;
        if (!is503(err) || attempt === MAX_RETRIES) throw err;
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    throw lastErr;
  }

  let geminiModel = makeModel(MODEL_CASCADE[0]);

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
      let scheduleMetadata: ScheduleMessageMetadata | null = null;
      try {
        let activeModelName = MODEL_CASCADE[0];
        let chat = geminiModel.startChat({ history });

        // Tool-calling loop: keep feeding function responses back until the model stops asking.
        let nextMessage: string | Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> =
          latestUserMsg.content;
        for (let turn = 0; turn < 4; turn++) {
          let result;
          try {
            result = await sendWithRetry(activeModelName, chat, nextMessage);
          } catch (err) {
            // If 503 persists after retries, cascade to the next model in the list.
            if (is503(err)) {
              const idx = MODEL_CASCADE.indexOf(activeModelName);
              const next = MODEL_CASCADE[idx + 1];
              if (next) {
                activeModelName = next;
                geminiModel = makeModel(next);
                chat = geminiModel.startChat({ history });
                result = await sendWithRetry(activeModelName, chat, nextMessage);
              } else {
                throw err; // all models exhausted
              }
            } else {
              throw err;
            }
          }
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
              const payload = await runAdvisorTool(call.name, call.args as Record<string, unknown>, supabase, user);
              toolTraces.push({ tool: call.name, args: call.args, result: payload });
              if (
                call.name === "build_schedule" &&
                Array.isArray((payload as { picks?: unknown }).picks) &&
                ((payload as { picks: unknown[] }).picks.length ?? 0) > 0 &&
                !("error" in payload)
              ) {
                scheduleMetadata = {
                  kind: "schedule",
                  picks: (payload as { picks: SchedulePick[] }).picks,
                  total_credits:
                    typeof (payload as { total_credits?: unknown }).total_credits === "number"
                      ? (payload as { total_credits: number }).total_credits
                      : 0,
                };
              }
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

        if (scheduleMetadata) {
          controller.enqueue(encoder.encode(encodeSchedulePayload(scheduleMetadata)));
        }

        if (fullText.trim() || scheduleMetadata) {
          await supabase.from("chat_messages").insert({
            session_id: sessionId!,
            user_id: user.id,
            role: "assistant",
            content: fullText,
            metadata: scheduleMetadata,
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
