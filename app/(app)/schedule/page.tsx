import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyScheduleClient from "./MyScheduleClient";
import type { SchedulePick } from "@/lib/advisor/chat-payload";

type Row = SchedulePick & { instructor_name?: string | null; room_name?: string | null };

function fmt(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5);
}

export default async function MySchedulePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = (user.user_metadata ?? {}) as { std_id?: number | string };
  const isFixtureUser = meta.std_id !== undefined;

  let rows: Row[] = [];
  let totalCredits = 0;

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
             course:course_id(course_id, course_na, credit_hours),
             room:room_id(room_id, building),
             instructor:instructor_id(instructor_name),
             time:time_id(day, s_time, e_time)
           )`
        )
        .eq("std_id", std.std_id);

      type Joined = {
        schedule_id: string;
        schedule: {
          course?: { course_id: string; course_na: string; credit_hours: number } | null;
          room?: { room_id: string; building: string | null } | null;
          instructor?: { instructor_name: string } | null;
          time?: { day: number; s_time: string; e_time: string } | null;
        } | null;
      };

      const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      rows = ((accepted ?? []) as unknown as Joined[]).map((r) => {
        const sched = r.schedule;
        return {
          schedule_id: r.schedule_id,
          course_id: sched?.course?.course_id ?? "",
          course_name: sched?.course?.course_na ?? "Course",
          credits: sched?.course?.credit_hours ?? 0,
          day: sched?.time ? dayMap[sched.time.day] ?? "Sunday" : "Sunday",
          start_time: fmt(sched?.time?.s_time),
          end_time: fmt(sched?.time?.e_time),
          room_id: sched?.room?.room_id,
          room_name: sched?.room?.building ?? null,
          instructor_name: sched?.instructor?.instructor_name ?? null,
        };
      });
      totalCredits = rows.reduce((sum, r) => sum + (r.credits ?? 0), 0);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="mb-8">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          ACCEPTED FOR THIS SEMESTER
        </p>
        <h1 className="font-headline text-display-sm text-on-surface font-bold mb-2">
          My Schedule
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant">
          Your accepted picks for the current semester. Edit or discard with the
          advisor.
        </p>
      </div>

      <MyScheduleClient
        mode={isFixtureUser ? "fixture" : "supabase"}
        initialRows={rows}
        totalCredits={totalCredits}
      />
    </div>
  );
}
