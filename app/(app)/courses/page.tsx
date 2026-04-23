import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CoursesClient from "./CoursesClient";

export default async function CoursesPage() {
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

  const { data: std } = await supabase
    .from("std")
    .select("std_id, plan_id, major_id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  if (!std?.plan_id) redirect("/onboarding");

  const { data: courses } = await supabase
    .from("course")
    .select("course_id, course_na, credit_hours, type, semester_order")
    .eq("plan_id", std.plan_id)
    .order("semester_order", { ascending: true, nullsFirst: false });

  const { data: history } = await supabase
    .from("std_course")
    .select("course_id, status, grade, semester_id")
    .eq("std_id", std.std_id);

  // Fetch current/past semesters for the dropdown
  const { data: semesters } = await supabase
    .from("semester")
    .select("semester_id, name, status")
    .order("semester_id", { ascending: false })
    .limit(10);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <h1 className="font-headline text-display-sm text-on-surface font-bold mb-2">
        My Courses
      </h1>
      <p className="font-body text-body-lg text-on-surface-variant mb-8">
        Mark completed or currently-enrolled courses so the advisor stays accurate.
      </p>
      <CoursesClient
        stdId={std.std_id}
        courses={courses ?? []}
        history={history ?? []}
        semesters={semesters ?? []}
      />
    </div>
  );
}
