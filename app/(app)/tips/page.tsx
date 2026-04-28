import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudyTipsClient, { type AcceptedCourse } from "./StudyTipsClient";

export default async function StudyTipsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = (user.user_metadata ?? {}) as { std_id?: number | string };
  const isFixtureUser = meta.std_id !== undefined;

  let courses: AcceptedCourse[] = [];

  if (!isFixtureUser) {
    const { data: std } = await supabase
      .from("std")
      .select("std_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (std?.std_id) {
      const { data: accepted } = await supabase
        .from("student_schedule")
        .select(
          `schedule_id,
           schedule:schedule_id(
             course:course_id(course_id, course_na, credit_hours)
           )`
        )
        .eq("std_id", std.std_id);

      type Joined = {
        schedule_id: string;
        schedule: {
          course?: { course_id: string; course_na: string; credit_hours: number } | null;
        } | null;
      };
      const seen = new Set<string>();
      for (const row of (accepted ?? []) as unknown as Joined[]) {
        const c = row.schedule?.course;
        if (!c) continue;
        if (seen.has(c.course_id)) continue;
        seen.add(c.course_id);
        courses.push({
          courseId: c.course_id,
          courseName: c.course_na,
          credits: c.credit_hours,
        });
      }
    }
  }

  return (
    <div className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      <div className="mb-10">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          PER-COURSE GUIDANCE
        </p>
        <h1 className="font-headline text-display-sm text-on-surface mb-3">
          Study Tips
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl">
          Tips for the courses you&apos;ve accepted into your schedule. Better
          tips come from a richer profile and the advisor.
        </p>
      </div>

      <StudyTipsClient
        mode={isFixtureUser ? "fixture" : "supabase"}
        initialCourses={courses}
      />
    </div>
  );
}
