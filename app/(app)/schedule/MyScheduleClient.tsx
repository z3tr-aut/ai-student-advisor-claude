"use client";

import Link from "next/link";
import type { StudentContext } from "@/lib/advisor/select";
import type { ScheduleResult } from "@/lib/advisor/schedule";
import type { Day } from "@/lib/advisor/fixtures";

const DAYS: Day[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const REASON_TEXT: Record<string, string> = {
  "no-section": "No section offered this semester",
  "all-conflict": "All sections clash with another pick",
  "out-of-window": "All sections fall outside your time preferences",
};

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function MyScheduleClient({
  student,
  targetCredits,
  result,
}: {
  student: StudentContext;
  targetCredits: number;
  result: ScheduleResult;
}) {
  const picksByDay = new Map<Day, typeof result.picks>();
  for (const pick of result.picks) {
    const list = picksByDay.get(pick.section.day) ?? [];
    list.push(pick);
    picksByDay.set(pick.section.day, list);
  }
  for (const list of picksByDay.values()) {
    list.sort((a, b) => a.section.startMinutes - b.section.startMinutes);
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-display-sm text-on-surface font-bold mb-1">
          My Schedule
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant">
          {student.major_na} — {student.plan_id} · target {targetCredits} credits
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-surface-container-low rounded-2xl p-6 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-headline text-title-md text-on-surface">
            Recommended load
          </span>
          <span className="font-headline text-title-lg text-primary font-bold">
            {result.totalCredits} / {targetCredits} credits
          </span>
        </div>
        <p className="font-body text-body-sm text-on-surface-variant">
          {result.picks.length} course{result.picks.length === 1 ? "" : "s"} scheduled
          {result.unscheduled.length > 0
            ? ` · ${result.unscheduled.length} couldn't fit`
            : ""}
        </p>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-1">
          {result.warnings.map((w, i) => (
            <p key={i} className="font-body text-body-sm text-amber-800">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Weekly grid */}
      {result.picks.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl p-6">
          <p className="font-body text-body-md text-on-surface-variant">
            No schedule picks yet. Mark which courses you've passed in{" "}
            <Link href="/courses" className="text-primary underline">
              My Courses
            </Link>
            , then come back to see a recommendation.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="font-headline text-headline-sm text-on-surface font-bold">
            Weekly grid
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {DAYS.map((day) => {
              const dayPicks = picksByDay.get(day) ?? [];
              return (
                <div
                  key={day}
                  className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-2"
                >
                  <p className="font-headline text-title-sm text-on-surface font-bold">
                    {day}
                  </p>
                  {dayPicks.length === 0 ? (
                    <p className="font-body text-body-sm text-on-surface-variant">
                      —
                    </p>
                  ) : (
                    dayPicks.map((pick) => (
                      <div
                        key={pick.section.id}
                        className="bg-blue-50 border border-blue-200 rounded-xl p-3"
                      >
                        <p
                          className="font-headline text-label-md text-blue-900 font-semibold"
                          dir="auto"
                        >
                          {pick.course.name}
                        </p>
                        <p className="font-body text-label-sm text-blue-800 mt-0.5">
                          {formatTime(pick.section.startMinutes)}–
                          {formatTime(pick.section.endMinutes)}
                          {pick.section.roomId
                            ? ` · room ${pick.section.roomId}`
                            : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unscheduled list */}
      {result.unscheduled.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-headline text-headline-sm text-on-surface font-bold">
            Couldn't schedule
          </h2>
          <div className="flex flex-col gap-2">
            {result.unscheduled.map((u) => (
              <div
                key={u.course.id}
                className="bg-orange-50 border border-orange-200 rounded-2xl p-4"
              >
                <p
                  className="font-headline text-title-sm text-orange-900 font-bold"
                  dir="auto"
                >
                  {u.course.name}
                </p>
                <p className="font-body text-body-sm text-orange-800 mt-0.5">
                  {u.course.id} · {u.course.credits} credits ·{" "}
                  {REASON_TEXT[u.reason] ?? u.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
