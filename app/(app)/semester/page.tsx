import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadActiveSemester,
  loadFixtureCatalogRows,
  type CatalogRow,
  type Day,
} from "@/lib/advisor/fixtures";
import SemesterScheduleClient from "./SemesterScheduleClient";

const DAY_BY_INT: Day[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
];

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [hh = "0", mm = "0"] = t.split(":");
  return Number(hh) * 60 + Number(mm);
}

export default async function SemesterSchedulePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = (user.user_metadata ?? {}) as { std_id?: number | string };
  const isFixtureUser = meta.std_id !== undefined;

  let rows: CatalogRow[] = [];
  let semesterName: string | null = null;
  if (isFixtureUser) {
    rows = loadFixtureCatalogRows();
    semesterName = loadActiveSemester().name;
  } else {
    const { data: activeSemester } = await supabase
      .from("semester")
      .select("semester_id, name")
      .eq("status", "current")
      .maybeSingle();

    if (activeSemester) {
      semesterName = activeSemester.name;

      const [{ data: scheduleRows }, { data: enrollments }] = await Promise.all([
        supabase
          .from("schedule")
          .select(
            `schedule_id,
             course:course_id(course_id, course_na, credit_hours),
             room:room_id(room_id, building, capacity),
             instructor:instructor_id(instructor_name),
             time:time_id(day, s_time, e_time)`
          )
          .eq("semester_id", activeSemester.semester_id),
        supabase
          .from("std_course")
          .select("section")
          .eq("status", "enrolled")
          .eq("semester_id", activeSemester.semester_id),
      ]);

      const enrolledBySection = new Map<string, number>();
      for (const row of enrollments ?? []) {
        if (!row.section) continue;
        enrolledBySection.set(row.section, (enrolledBySection.get(row.section) ?? 0) + 1);
      }

      type Joined = {
        schedule_id: string;
        course?: { course_id: string; course_na: string; credit_hours: number } | null;
        room?: { room_id: string; building: string | null; capacity: number | null } | null;
        instructor?: { instructor_name: string } | null;
        time?: { day: number; s_time: string; e_time: string } | null;
      };

      rows = ((scheduleRows ?? []) as unknown as Joined[]).map((s) => {
        const dayIdx = s.time?.day ?? 0;
        const day = DAY_BY_INT[dayIdx] ?? "Sunday";
        return {
          sectionId: s.schedule_id,
          courseId: s.course?.course_id ?? "",
          courseName: s.course?.course_na ?? "Course",
          creditHours: s.course?.credit_hours ?? 0,
          day,
          startMinutes: timeToMinutes(s.time?.s_time),
          endMinutes: timeToMinutes(s.time?.e_time),
          roomName: s.room?.building ?? null,
          instructorName: s.instructor?.instructor_name ?? null,
          capacity: s.room?.capacity ?? 0,
          enrolledCount: enrolledBySection.get(s.schedule_id) ?? 0,
        } satisfies CatalogRow;
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      <div className="mb-8">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          {semesterName ? `${semesterName.toUpperCase()} OFFERINGS` : "OFFERINGS"}
        </p>
        <h1 className="font-headline text-display-sm text-on-surface font-bold mb-2">
          Semester Schedule
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant">
          Every class the university is offering this semester — room,
          instructor, time, and how many students are already enrolled.
        </p>
      </div>

      {rows.length > 0 ? (
        <SemesterScheduleClient rows={rows} />
      ) : (
        <div className="advisor-card text-center py-16">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-surface-variant items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: "28px" }}>
              menu_book
            </span>
          </div>
          <h3 className="font-headline text-headline-sm text-on-surface mb-3">
            No catalog available yet
          </h3>
          <p className="font-body text-body-md text-on-surface-variant max-w-md mx-auto">
            Sign in with a seeded test student to see the fixture catalog.
            Production catalogs will be wired to Supabase in a follow-up.
          </p>
        </div>
      )}
    </div>
  );
}
