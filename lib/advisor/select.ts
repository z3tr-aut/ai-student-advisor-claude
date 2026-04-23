/**
 * DB-aware wrapper around engine.ts.
 *
 * Loads a student's plan + history from Supabase (RLS-protected) and hands the
 * pure data to the rule engine. Used by both /api/advisor/recommend and the
 * Gemini tool-calling loop in /api/chat.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recommendForSemester,
  type Course,
  type CourseType,
  type RecommendResult,
  type StudentHistory,
} from "./engine";

export type StudentContext = {
  std_id: string;
  std_na: string;
  plan_id: string;
  plan_name: string;
  major_id: string;
  major_na: string;
  plan_total_credits: number;
};

export type RecommendOutcome = {
  student: StudentContext;
  result: RecommendResult;
};

/** Resolves the std row for the currently-authenticated user. */
export async function getStudentContext(
  supabase: SupabaseClient,
  authUserId: string
): Promise<StudentContext | null> {
  const { data, error } = await supabase
    .from("std")
    .select(
      `std_id, std_na, major_id, plan_id,
       plan:plan_id ( plan_id, name, major_id ),
       major:major_id ( major_id, major_na, credit_hours )`
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const plan = (data.plan as unknown) as { plan_id: string; name: string } | null;
  const major = (data.major as unknown) as { major_id: string; major_na: string; credit_hours: number } | null;
  if (!plan || !major) return null;
  return {
    std_id: data.std_id,
    std_na: data.std_na,
    plan_id: plan.plan_id,
    plan_name: plan.name,
    major_id: major.major_id,
    major_na: major.major_na,
    plan_total_credits: major.credit_hours,
  };
}

async function loadPlanCourses(supabase: SupabaseClient, planId: string): Promise<Course[]> {
  const { data: courses, error: cErr } = await supabase
    .from("course")
    .select("course_id, course_na, credit_hours, type, semester_order")
    .eq("plan_id", planId);
  if (cErr) throw cErr;
  if (!courses) return [];

  const { data: prereqs, error: pErr } = await supabase
    .from("course_prereq")
    .select("course_id, prereq_course_id")
    .in(
      "course_id",
      courses.map((c) => c.course_id)
    );
  if (pErr) throw pErr;

  const prereqMap = new Map<string, string[]>();
  for (const p of prereqs ?? []) {
    const list = prereqMap.get(p.course_id) ?? [];
    list.push(p.prereq_course_id);
    prereqMap.set(p.course_id, list);
  }

  return courses.map((c) => ({
    id: c.course_id,
    name: c.course_na,
    credits: c.credit_hours,
    type: (c.type ?? "required") as CourseType,
    prereqIds: prereqMap.get(c.course_id) ?? [],
    semesterOrder: c.semester_order ?? null,
  }));
}

async function loadHistory(supabase: SupabaseClient, stdId: string): Promise<StudentHistory> {
  const { data, error } = await supabase
    .from("std_course")
    .select("course_id, status")
    .eq("std_id", stdId);
  if (error) throw error;
  const passed = new Set<string>();
  const enrolled = new Set<string>();
  const failed = new Set<string>();
  for (const row of data ?? []) {
    if (row.status === "passed") passed.add(row.course_id);
    else if (row.status === "enrolled") enrolled.add(row.course_id);
    else if (row.status === "failed") failed.add(row.course_id);
  }
  return { passed, enrolled, failed };
}

export async function recommendForUser(
  supabase: SupabaseClient,
  authUserId: string,
  targetCredits: number
): Promise<RecommendOutcome | { error: string }> {
  const student = await getStudentContext(supabase, authUserId);
  if (!student) {
    return {
      error:
        "You haven't picked a study plan yet. Please complete onboarding to link your university ID and plan.",
    };
  }
  const [plan, history] = await Promise.all([
    loadPlanCourses(supabase, student.plan_id),
    loadHistory(supabase, student.std_id),
  ]);
  if (plan.length === 0) {
    return { error: `No courses are defined for plan ${student.plan_id}.` };
  }
  const result = recommendForSemester({
    plan,
    history,
    targetCredits,
    planTotalCredits: student.plan_total_credits,
  });
  return { student, result };
}
