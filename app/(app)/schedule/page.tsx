import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getStudentContext } from "@/lib/advisor/select";
import { recommendSchedule } from "@/lib/advisor/schedule";
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
    .select("std_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile?.std_id) redirect("/onboarding");

  const student = await getStudentContext(supabase, user!.id);
  if (!student) redirect("/onboarding");

  // Sections aren't seeded into the DB yet, so we drive the timetable from the
  // same fixture data the chat tool uses. The std_id we resolved from auth is
  // the lookup key into the fixture (test students 1001/1002/1003 are wired
  // up; other students fall through to an empty schedule).
  const scenario = buildStudentScenario(student.std_id);
  const result = recommendSchedule({
    plan: scenario.courses,
    sections: scenario.sections,
    history: scenario.history,
    targetCredits: DEFAULT_TARGET_CREDITS,
  });

  return (
    <MyScheduleClient
      student={student}
      targetCredits={DEFAULT_TARGET_CREDITS}
      result={result}
    />
  );
}
