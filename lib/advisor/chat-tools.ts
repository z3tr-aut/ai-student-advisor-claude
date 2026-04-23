/**
 * Gemini function-calling declarations and handlers for the advisor engine.
 */
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recommendForUser, type RecommendOutcome } from "./select";

export const advisorTools: FunctionDeclaration[] = [
  {
    name: "recommend_courses",
    description:
      "Compute the list of courses the student is eligible to take next semester, " +
      "based on their study plan, passed courses, and a target credit-hour load. " +
      "Call this whenever the student asks for course recommendations, scheduling help, " +
      "what to register for, or which courses are available.",
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
];

/** Executes a tool call and returns a JSON-serialisable payload for Gemini. */
export async function runAdvisorTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  authUserId: string
): Promise<Record<string, unknown>> {
  if (name === "recommend_courses") {
    const target = Number(args.target_credits ?? 15);
    const outcome = await recommendForUser(supabase, authUserId, target);
    return serializeOutcome(outcome);
  }
  return { error: `Unknown tool: ${name}` };
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
