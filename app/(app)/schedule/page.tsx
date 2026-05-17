import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getStudentContext } from "@/lib/advisor/select";
import { recommendSchedule, type ScheduleResult } from "@/lib/advisor/schedule";
import { buildStudentScenario } from "@/lib/advisor/fixtures";
import MyScheduleClient from "./MyScheduleClient";

const DEFAULT_TARGET_CREDITS = 15;

export default async function SchedulePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("std_id, last_schedule")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.std_id) redirect("/onboarding");

  const student = await getStudentContext(supabase, user!.id);
  if (!student) redirect("/onboarding");

  // Prefer the snapshot the chat tool wrote on the last build_schedule call so
  // this page mirrors exactly what the advisor just built (e.g. 18 credits,
  // "no Thursday"). Fall back to a fresh default compute for users who haven't
  // built a schedule yet. Sections aren't seeded into the DB, so the fallback
  // is driven by the same fixture data the chat tool uses.
  const snapshot = profile.last_schedule as
    | { targetCredits?: number; result?: ScheduleResult }
    | null;

  let targetCredits = DEFAULT_TARGET_CREDITS;
  let result: ScheduleResult;

  if (snapshot?.result) {
    targetCredits = snapshot.targetCredits ?? DEFAULT_TARGET_CREDITS;
    result = snapshot.result;
  } else {
    const scenario = buildStudentScenario(student.std_id);
    result = recommendSchedule({
      plan: scenario.courses,
      sections: scenario.sections,
      history: scenario.history,
      targetCredits: DEFAULT_TARGET_CREDITS,
    });
  }

  return (
    <MyScheduleClient
      student={student}
      targetCredits={targetCredits}
      result={result}
    />
  );
}
