import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import CourseProgressTracker from "@/components/CourseProgressTracker";
import {
  buildStudentScenario,
  loadFixtureSemesters,
  loadFixtureTranscript,
  resolveStudentMajorId,
} from "@/lib/advisor/fixtures";
import { resolveServerLang } from "@/lib/i18n/serverLang";
import { translate } from "@/lib/i18n/dict";

type TrackerData = {
  stdId: string;
  readOnly: boolean;
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
};

export default async function ProfilePage() {
  const supabase = createClient();
  const lang = await resolveServerLang();
  const t = (key: string) => translate(lang, key);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const meta = (user!.user_metadata ?? {}) as { std_id?: number | string };
  const fixtureStdId = meta.std_id;

  let trackerData: TrackerData | null = null;

  if (fixtureStdId !== undefined) {
    // Fixture user — read-only transcript view from JSON fixtures.
    const scenario = buildStudentScenario(fixtureStdId);
    const transcript = loadFixtureTranscript(fixtureStdId);
    const fixtureSemesters = loadFixtureSemesters();
    const majorId = resolveStudentMajorId(fixtureStdId);
    trackerData = {
      stdId: String(fixtureStdId),
      readOnly: true,
      courses: scenario.courses
        .filter((c) => majorId === null || true)
        .map((c) => ({
          course_id: c.id,
          course_na: c.name,
          credit_hours: c.credits,
          type: c.type,
          semester_order: c.semesterOrder ?? null,
        })),
      history: transcript.map((t) => ({
        course_id: t.courseId,
        status: t.status,
        grade: t.grade ? parseFloat(t.grade) || null : null,
        semester_id: t.semesterId,
      })),
      semesters: fixtureSemesters.map((s) => ({
        semester_id: s.id,
        name: s.name,
        status: s.status,
      })),
    };
  } else {
    const { data: std } = await supabase
      .from("std")
      .select("std_id, plan_id")
      .eq("auth_user_id", user!.id)
      .maybeSingle();

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
        readOnly: false,
        courses: courses ?? [],
        history: history ?? [],
        semesters: semesters ?? [],
      };
    }
  }

  return (
    <div className="px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <div className="mb-10">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          {t("profile.eyebrow")}
        </p>
        <h1 className="font-headline text-display-sm text-on-surface mb-3">
          {t("profile.heading")}
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl">
          {t("profile.subheading")}
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
              {t("profile.tracker.eyebrow")}
            </p>
            <h2 className="font-headline text-headline-md text-on-surface mb-2">
              {t("profile.tracker.heading")}
            </h2>
            <p className="font-body text-body-md text-on-surface-variant">
              {trackerData.readOnly
                ? t("profile.tracker.subheadingReadOnly")
                : t("profile.tracker.subheading")}
            </p>
          </div>
          <CourseProgressTracker
            stdId={trackerData.stdId}
            courses={trackerData.courses}
            history={trackerData.history}
            semesters={trackerData.semesters}
            readOnly={trackerData.readOnly}
          />
        </section>
      )}
    </div>
  );
}
