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
    "There is also a save_recommendation tool. When the student explicitly asks you to save/keep/bookmark a suggestion you gave about their MAJOR, CAREER path, or UNIVERSITY choice, call save_recommendation with kind ('major' | 'career' | 'university'), a short title, and a 1-2 sentence summary of that advice, then confirm in one short sentence. Do not use it for course schedules.",
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

// True for Gemini quota / rate-limit errors. Retrying or cascading to other
// models on these is pointless — every gemini-* model shares the key's quota
// and each extra call burns it ~30× faster.
function isQuotaError(e: unknown): boolean {
  const status = (e as { status?: number } | null | undefined)?.status;
  if (status === 429) return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /\b429\b|quota|rate.?limit|resource[_ ]?exhausted|too many requests/i.test(msg);
}

const DAY_WORDS: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
};

function to24h(hourStr: string, minStr: string | undefined, ampm: string | undefined): string | undefined {
  let h = parseInt(hourStr, 10);
  if (Number.isNaN(h)) return undefined;
  const ap = ampm?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h < 0 || h > 23) return undefined;
  const mm = minStr && /^\d{2}$/.test(minStr) ? minStr : "00";
  return `${String(h).padStart(2, "0")}:${mm}`;
}

// Conservative server-side intent parser. Only fires on explicit schedule /
// recommendation asks so normal conversation still goes to Gemini. Lets the
// core demo run the deterministic engine with ZERO Gemini calls.
function parseAdvisorIntent(
  text: string,
): { tool: "build_schedule" | "recommend_courses"; args: Record<string, unknown> } | null {
  const t = text.toLowerCase();
  const wantSchedule =
    /\bschedule\b/.test(t) || /\btimetable\b/.test(t) || (/\bbuild\b/.test(t) && /\bplan\b/.test(t));
  const wantRecommend =
    /\brecommend/.test(t) ||
    /what (can|should) i (take|register)/.test(t) ||
    /which courses/.test(t) ||
    /courses? (i can|to take|next semester|next term)/.test(t);
  if (!wantSchedule && !wantRecommend) return null;

  let target = 15;
  const cm = t.match(/(\d{1,2})\s*(?:-|\s)?\s*(?:credit|cred|hour|hr|h)\b/);
  if (cm) {
    const n = parseInt(cm[1], 10);
    if (n >= 1 && n <= 24) target = n;
  }

  if (wantSchedule) {
    const args: Record<string, unknown> = { target_credits: target };
    const excluded: string[] = [];
    for (const [k, v] of Object.entries(DAY_WORDS)) {
      if (new RegExp(`(no|not|without|skip|avoid|don'?t|free|off)\\b[^.]{0,20}\\b${k}\\b|\\b${k}\\b[^.]{0,12}\\b(off|free)\\b`).test(t)) {
        excluded.push(v);
      }
    }
    if (excluded.length) args.excluded_days = excluded;

    const em = t.match(
      /(?:after|from|start(?:ing)?\s*(?:at|from)?|not?\s*before|nothing\s*before|no\s*class(?:es)?\s*before)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
    );
    if (em) {
      const v = to24h(em[1], em[2], em[3]);
      if (v) args.earliest_start = v;
    }
    const lm = t.match(
      /(?:no\s*class(?:es)?\s*after|nothing\s*after|end(?:ing)?\s*(?:by|before|at)|(?:before|by|until|till))\s*(\d{1,2})(?::(\d{2}))?\s*(pm)/,
    );
    if (lm) {
      const v = to24h(lm[1], lm[2], lm[3]);
      if (v) args.latest_end = v;
    }
    return { tool: "build_schedule", args };
  }
  return { tool: "recommend_courses", args: { target_credits: target } };
}

// Conservative "save this suggestion" detector. Fires only on an explicit
// save/keep/bookmark request about a major / career / university (never a
// schedule). Lets the Recommendations save work with ZERO Gemini calls by
// snapshotting the previous assistant message.
function parseSaveIntent(text: string): { kind: "major" | "career" | "university" } | null {
  const t = text.toLowerCase();
  if (!/\b(save|keep|bookmark|pin)\b/.test(t)) return null;
  if (!/\b(recommendation|recommend|suggestion|suggest|advice|idea|this|that|it)\b/.test(t)) return null;
  // Schedule/course-list saves are handled elsewhere; don't hijack them.
  if (/\b(schedule|timetable|course|courses|credit|credits)\b/.test(t)) return null;
  let kind: "major" | "career" | "university" = "major";
  if (/\b(career|careers|job|jobs|profession\w*|work field|workplace)\b/.test(t)) kind = "career";
  else if (/\b(universit\w*|college|study abroad|abroad|grad school|graduate school)\b/.test(t)) kind = "university";
  else if (/\b(major|majors|degree|specializ\w*|field of study|discipline)\b/.test(t)) kind = "major";
  return { kind };
}

// Deterministic, Gemini-free renderer for a tool result. Shared by the
// intent shortcut and the no-text fallback.
function formatToolTrace(
  toolTraces: Array<{ tool: string; args: unknown; result: unknown }>,
): string | null {
  const reasonText: Record<string, string> = {
    "no-section": "no section offered this term",
    "out-of-window": "no section fits your time preferences",
    "all-conflict": "every section clashes with another pick",
  };
  const asStr = (v: unknown) => (typeof v === "string" ? v : undefined);
  const asNum = (v: unknown) => (typeof v === "number" ? v : undefined);
  const lastResult = (name: string) =>
    [...toolTraces].reverse().find((t) => t.tool === name)?.result as
      | Record<string, unknown>
      | undefined;

  const sched = lastResult("build_schedule");
  if (sched && Array.isArray(sched.picks)) {
    const tc = asNum(sched.total_credits);
    const lines: string[] = [
      `Here's your schedule${tc !== undefined ? ` (${tc} credit hours)` : ""}:`,
    ];
    for (const p of sched.picks as Array<Record<string, unknown>>) {
      const nm = asStr(p.course_name) ?? "Course";
      const day = asStr(p.day) ?? "";
      const s = asStr(p.start_time) ?? "";
      const e = asStr(p.end_time) ?? "";
      lines.push(`• ${nm} — ${day} ${s}–${e}`.trimEnd());
    }
    const un = Array.isArray(sched.unscheduled)
      ? (sched.unscheduled as Array<Record<string, unknown>>)
      : [];
    if (un.length) {
      lines.push("", "Couldn't place:");
      for (const u of un) {
        const nm = asStr(u.course_name) ?? "Course";
        const r = asStr(u.reason) ?? "";
        lines.push(`• ${nm} — ${reasonText[r] ?? r}`);
      }
    }
    const warns = Array.isArray(sched.warnings) ? (sched.warnings as unknown[]) : [];
    for (const w of warns) if (asStr(w)) lines.push(`Note: ${asStr(w)}`);
    return lines.join("\n");
  }

  const rec = lastResult("recommend_courses");
  if (rec && Array.isArray(rec.picks)) {
    const tc = asNum(rec.target_credits);
    const lines: string[] = [
      `Recommended courses${tc !== undefined ? ` (${tc} credit hours)` : ""}:`,
    ];
    for (const p of rec.picks as Array<Record<string, unknown>>) {
      const nm = asStr(p.course_name) ?? "Course";
      const cr = asNum(p.credits);
      lines.push(`• ${nm}${cr !== undefined ? ` (${cr} cr)` : ""}`);
    }
    const warns = Array.isArray(rec.warnings) ? (rec.warnings as unknown[]) : [];
    for (const w of warns) if (asStr(w)) lines.push(`Note: ${asStr(w)}`);
    return lines.join("\n");
  }
  return null;
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
        // Deterministic shortcut: explicit "build a schedule" / "recommend
        // courses" asks run the engine directly with ZERO Gemini calls, so
        // the core demo is quota-proof. Anything else still goes to Gemini.
        if (fixtureStdId !== undefined) {
          try {
            const intent = parseAdvisorIntent(latestUserMsg.content);
            if (intent) {
              const payload = await runAdvisorTool(intent.tool, intent.args, supabase, user);
              toolTraces.push({ tool: intent.tool, args: intent.args, result: payload });
              const text = formatToolTrace(toolTraces);
              if (text) {
                fullText = text;
                controller.enqueue(encoder.encode(text));
              }
            }
          } catch (e) {
            console.error("[/api/chat] deterministic shortcut failed:", e);
          }
        }

        // Deterministic "save this suggestion" → write straight to the
        // Recommendations page with ZERO Gemini calls. Works for every user
        // (recommendations is a real per-user table). Snapshots the previous
        // assistant message as the saved summary.
        if (!fullText.trim()) {
          try {
            const save = parseSaveIntent(latestUserMsg.content);
            if (save && !parseAdvisorIntent(latestUserMsg.content)) {
              const prevAssistant = [...messages.slice(0, -1)]
                .reverse()
                .find(
                  (m) => m.role === "assistant" && !!m.content && m.content.trim().length > 0,
                );
              if (prevAssistant) {
                const body = prevAssistant.content.trim();
                const firstSentence = body.split(/(?<=[.!?])\s|\n/)[0] || body;
                const title = firstSentence.slice(0, 90).trim();
                const summary = body.slice(0, 600).trim();
                const payload = await runAdvisorTool(
                  "save_recommendation",
                  { kind: save.kind, title, summary },
                  supabase,
                  user,
                );
                toolTraces.push({
                  tool: "save_recommendation",
                  args: { kind: save.kind, title },
                  result: payload,
                });
                const ok = (payload as { saved?: boolean }).saved === true;
                const msg = ok
                  ? `Saved that to your Recommendations page — it's filed under ${save.kind}.`
                  : `I couldn't save that just now: ${
                      (payload as { error?: string }).error ?? "unknown error"
                    }`;
                fullText = msg;
                controller.enqueue(encoder.encode(msg));
              }
            }
          } catch (e) {
            console.error("[/api/chat] save shortcut failed:", e);
          }
        }

        // The SDK's response.text() / response.functionCalls() THROW when the
        // candidate finished with no usable content (MALFORMED_FUNCTION_CALL,
        // SAFETY, RECITATION, MAX_TOKENS, OTHER). Never let it crash the stream.
        const safeText = (r: { text: () => string }): string => {
          try {
            return r.text() ?? "";
          } catch {
            return "";
          }
        };

        type ChatSession = ReturnType<ReturnType<typeof genAI.getGenerativeModel>["startChat"]>;

        // Retry only transient 5xx/overloaded. NEVER retry quota/rate-limit —
        // it's hopeless and burns the shared key quota faster.
        const sendWithRetry = async (c: ChatSession, msg: string) => {
          let lastErr: unknown;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              return await c.sendMessage(msg);
            } catch (e) {
              lastErr = e;
              if (isQuotaError(e)) throw e;
              await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            }
          }
          throw lastErr;
        };

        // Cascade across function-calling-capable models so one model's
        // outage/quota doesn't break the advisor. Each model gets a fresh
        // chat replayed from the same history + user message.
        const MODELS = [...new Set([modelName, "gemini-2.0-flash", "gemini-1.5-flash"])];
        let finishReason: string | undefined;
        let quotaHit = false;

        for (const m of MODELS) {
          if (fullText.trim()) break; // an earlier model already answered

          let chat: ChatSession;
          try {
            chat = genAI
              .getGenerativeModel({
                model: m,
                systemInstruction: systemPrompt,
                tools: [{ functionDeclarations: advisorTools }],
              })
              .startChat({ history });
          } catch (e) {
            console.error(`[/api/chat] model init failed (${m}):`, e);
            continue;
          }

          let nextMessage: string | Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> =
            latestUserMsg.content;
          let streamed = false;
          let modelFailed = false;

          for (let turn = 0; turn < 4; turn++) {
            let response;
            try {
              const result = await sendWithRetry(chat, nextMessage as string);
              response = result.response;
            } catch (e) {
              console.error(`[/api/chat] sendMessage failed (model=${m} turn=${turn}):`, e);
              modelFailed = true;
              if (isQuotaError(e)) quotaHit = true;
              break;
            }
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
                streamed = true;
                controller.enqueue(encoder.encode(text));
              }
              break;
            }

            let responses;
            try {
              responses = await Promise.all(
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
            } catch (e) {
              console.error("[/api/chat] tool execution failed:", e);
              modelFailed = true;
              break;
            }
            nextMessage = responses as unknown as string;
          }

          // Keep streamed output (don't cascade and duplicate). Don't cascade
          // on quota — every gemini-* model shares the key's quota, so trying
          // the next one just burns it faster. Only cascade on transient 5xx.
          if (streamed || fullText.trim()) break;
          if (quotaHit) break;
          if (modelFailed) continue;
          break;
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

          // Gemini gave no text (commonly quota/overload). If a tool ran,
          // render its result deterministically so schedules/recommendations
          // still work with zero Gemini text capacity.
          fullText =
            formatToolTrace(toolTraces) ??
            "I couldn't put that together just now. Try rephrasing — for example: \"build a 15-credit schedule with no Thursday classes and nothing before 9 AM.\"";
          controller.enqueue(encoder.encode(fullText));
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
