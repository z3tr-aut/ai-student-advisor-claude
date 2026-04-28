import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import CourseProgressTracker from "@/components/CourseProgressTracker";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: std } = await supabase
    .from("std")
    .select("std_id, plan_id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  let trackerData: {
    stdId: string;
    courses: Array<{
      course_id: string;
      course_na: string;
      credit_hours: number;
      type: string;
      semester_order: number | null;
    }>;
    history: Array<{
      course_id: string;
      status: string;
      grade: number | null;
      semester_id: string | null;
    }>;
    semesters: Array<{ semester_id: string; name: string; status: string }>;
  } | null = null;

  if (std?.plan_id && std.std_id) {
    const [{ data: courses }, { data: history }, { data: semesters }] = await Promise.all([
      supabase
        .from("course")
        .select("course_id, course_na, credit_hours, type, semester_order")
        .eq("plan_id", std.plan_id)
        .order("semester_order", { ascending: true, nullsFirst: false }),
      supabase
        .from("std_course")
        .select("course_id, status, grade, semester_id")
        .eq("std_id", std.std_id),
      supabase
        .from("semester")
        .select("semester_id, name, status")
        .order("semester_id", { ascending: false })
        .limit(10),
    ]);
    trackerData = {
      stdId: std.std_id,
      courses: courses ?? [],
      history: history ?? [],
      semesters: semesters ?? [],
    };
  }

  return (
    <div className="px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <div className="mb-10">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          YOUR PROFILE
        </p>
        <h1 className="font-headline text-display-sm text-on-surface mb-3">
          Tell me who you are
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl">
          The more I know about your interests and goals, the sharper my
          recommendations become. You can update any field at any time.
        </p>
      </div>

      <ProfileForm
        initial={{
          full_name: profile?.full_name ?? "",
          email: profile?.email ?? user?.email ?? "",
          education_level: profile?.education_level ?? "",
          bio: profile?.bio ?? "",
          interests: profile?.interests ?? [],
          skills: profile?.skills ?? [],
          preferred_countries: profile?.preferred_countries ?? [],
          grades: profile?.grades ?? {},
        }}
      />

      {trackerData && (
        <section className="mt-16 pt-10 border-t border-outline-variant">
          <div className="mb-6">
            <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
              COURSE PROGRESS
            </p>
            <h2 className="font-headline text-headline-md text-on-surface mb-2">
              Your transcript
            </h2>
            <p className="font-body text-body-md text-on-surface-variant">
              Mark passed and currently-enrolled courses so the advisor knows
              what prerequisites you&apos;ve cleared.
            </p>
          </div>
          <CourseProgressTracker
            stdId={trackerData.stdId}
            courses={trackerData.courses}
            history={trackerData.history}
            semesters={trackerData.semesters}
          />
        </section>
      )}
    </div>
  );
}
