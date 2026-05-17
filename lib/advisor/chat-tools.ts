/**
 * Gemini function-calling declarations and handlers for the advisor engine.
 *
 * Two tools are exposed:
 *   - recommend_courses → bare list of eligible courses for a target load.
 *   - build_schedule    → concrete weekly schedule with day/time picks,
 *                         honoring earliest_start / latest_end / excluded_days.
 *
 * Routing: if the authenticated user has `std_id` in user_metadata (set by the
 * test-student seed script), both tools run against the fixture JSON. Otherwise
 * they fall back to the Supabase-backed implementation in select.ts.
 */
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { recommendForUser, type RecommendOutcome } from "./select";
import { recommendForSemester, type RecommendResult } from "./engine";
import { recommendSchedule, type ScheduleResult } from "./schedule";
import { buildStudentScenario, type Day, type StudentScenario } from "./fixtures";
import coursesJson from "./fixtures/data/courses.json";

// Course-id → Arabic name lookup, used to add an `ar` variant to every
// chat-tool response. The LLM picks the right one based on the language
// directive in the system prompt.
const COURSE_NAME_AR: Record<string, string> = Object.fromEntries(
  (coursesJson as Array<{ course_id: number; course_name_ar?: string }>)
    .filter((c) => c.course_name_ar)
    .map((c) => [String(c.course_id), c.course_name_ar as string])
);

function arName(courseId: string, fallback: string): string {
  return COURSE_NAME_AR[courseId] ?? fallback;
}

export const advisorTools: FunctionDeclaration[] = [
  {
    name: "recommend_courses",
    description:
      "Compute the list of courses the student is eligible to take next semester, " +
      "based on their study plan, passed courses, and a target credit-hour load. " +
      "Call this for plain 'what can I take' questions with no time-of-day preferences. " +
      "If the student mentions any time preference, call build_schedule instead.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        target_credits: {
          type: SchemaType.NUMBER,
          description:
            "Target credit hours for the upcoming semester (usually 12–18). Default to 15 if the user hasn't said.",
        },
      },
      required: ["target_credits"],
    },
  },
  {
    name: "build_schedule",
    description:
      "Build a concrete weekly class schedule with specific section day/time/room assignments. " +
      "Call this whenever the student mentions ANY of: a time-of-day preference (no class before/after X), " +
      "an excluded day, or explicitly asks for a 'schedule' (not just a course list). " +
      "Returns picks tied to specific sections plus a list of courses we couldn't place and why.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        target_credits: {
          type: SchemaType.NUMBER,
          description: "Target credit hours for the semester (usually 12–18). Default to 15 if unspecified.",
        },
        earliest_start: {
          type: SchemaType.STRING,
          description:
            "Earliest acceptable class start time as 'HH:MM' (24-hour). E.g. '08:00' for 'no class before 8 AM'. Omit if no preference.",
        },
        latest_end: {
          type: SchemaType.STRING,
          description:
            "Latest acceptable class end time as 'HH:MM' (24-hour). E.g. '17:00' for 'nothing after 5 PM'. Omit if no preference.",
        },
        excluded_days: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description:
            "Days the student wants to keep free, each one of: Sunday, Monday, Tuesday, Wednesday, Thursday. Omit or empty if no preference.",
        },
      },
      required: ["target_credits"],
    },
  },
];

function getFixtureStdId(user: User): number | string | undefined {
  const meta = user.user_metadata as { std_id?: number | string } | null | undefined;
  return meta?.std_id;
}

/** Executes a tool call and returns a JSON-serialisable payload for Gemini. */
export async function runAdvisorTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  user: User
): Promise<Record<string, unknown>> {
  const fixtureStdId = getFixtureStdId(user);

  if (name === "recommend_courses") {
    const target = Number(args.target_credits ?? 15);
    if (fixtureStdId !== undefined) {
      const scenario = buildStudentScenario(fixtureStdId);
      const result = recommendForSemester({
        plan: scenario.courses,
        history: scenario.history,
        targetCredits: target,
      });
      return serializeFixtureCourseResult(scenario, result);
    }
    const outcome = await recommendForUser(supabase, user.id, target);
    return serializeOutcome(outcome);
  }

  if (name === "build_schedule") {
    if (fixtureStdId === undefined) {
      return {
        error:
          "build_schedule is only available for fixture-backed test users right now. Sign in with a seeded student account.",
      };
    }
    const scenario = buildStudentScenario(fixtureStdId);
    const target = Number(args.target_credits ?? 15);
    const earliestStart = typeof args.earliest_start === "string" ? args.earliest_start : undefined;
    const latestEnd = typeof args.latest_end === "string" ? args.latest_end : undefined;
    const excludedDays = Array.isArray(args.excluded_days)
      ? (args.excluded_days.filter((d) => typeof d === "string") as Day[])
      : undefined;

    const result = recommendSchedule({
      plan: scenario.courses,
      sections: scenario.sections,
      history: scenario.history,
      targetCredits: target,
      preferences: { earliestStart, latestEnd, excludedDays },
    });

    // NOTE: the My-Schedule snapshot is written AFTER the stream in the chat
    // route (from the tool trace), not here — keeping this tool path free of
    // extra I/O so a slow/failed write can never affect the model turn.
    return serializeFixtureScheduleResult(scenario, result);
  }

  return { error: `Unknown tool: ${name}` };
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}

function serializeFixtureCourseResult(
  scenario: StudentScenario,
  result: RecommendResult
): Record<string, unknown> {
  return {
    student: {
      std_id: scenario.stdId,
      major_id: scenario.majorId,
      passed_count: scenario.history.passed.size,
      credits_completed: result.creditsCompleted,
    },
    target_credits: result.totalCredits,
    picks: result.picks.map((c) => ({
      course_id: c.id,
      course_name: c.name,
      course_name_ar: arName(c.id, c.name),
      credits: c.credits,
    })),
    eligible_remaining: result.eligibleCount,
    locked_examples: result.lockedByPrereq.slice(0, 5).map((l) => ({
      course_id: l.course.id,
      course_name: l.course.name,
      course_name_ar: arName(l.course.id, l.course.name),
      missing_prereqs: l.missing,
    })),
    warnings: result.warnings,
  };
}

function serializeFixtureScheduleResult(
  scenario: StudentScenario,
  result: ScheduleResult
): Record<string, unknown> {
  return {
    student: {
      std_id: scenario.stdId,
      major_id: scenario.majorId,
      passed_count: scenario.history.passed.size,
    },
    total_credits: result.totalCredits,
    picks: result.picks.map((p) => ({
      course_id: p.course.id,
      course_name: p.course.name,
      course_name_ar: arName(p.course.id, p.course.name),
      credits: p.course.credits,
      day: p.section.day,
      start_time: fmtMinutes(p.section.startMinutes),
      end_time: fmtMinutes(p.section.endMinutes),
      room_id: p.section.roomId,
    })),
    unscheduled: result.unscheduled.map((u) => ({
      course_id: u.course.id,
      course_name: u.course.name,
      course_name_ar: arName(u.course.id, u.course.name),
      reason: u.reason,
    })),
    warnings: result.warnings,
  };
}

function serializeOutcome(outcome: RecommendOutcome | { error: string }): Record<string, unknown> {
  if ("error" in outcome) return { error: outcome.error };
  const { student, result } = outcome;
  return {
    student: {
      name: student.std_na,
      major: student.major_na,
      plan: student.plan_name,
      total_credits_required: student.plan_total_credits,
      credits_completed: result.creditsCompleted,
    },
    target_credits: result.totalCredits,
    picks: result.picks.map((c) => ({
      course_id: c.id,
      course_name: c.name,
      credits: c.credits,
      type: c.type,
    })),
    eligible_remaining: result.eligibleCount,
    locked_examples: result.lockedByPrereq.slice(0, 5).map((l) => ({
      course_id: l.course.id,
      course_name: l.course.name,
      missing_prereqs: l.missing,
    })),
    warnings: result.warnings,
  };
}
