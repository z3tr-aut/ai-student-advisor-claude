"use client";

import { useState, useMemo } from "react";

type DBCourse = {
  course_id: string;
  course_na: string;
  credit_hours: number;
  type: string;
  semester_order: number | null;
};
type HistoryRow = {
  course_id: string;
  status: string;
  grade: number | null;
  semester_id: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  passed: "bg-green-100 text-green-800 border-green-200",
  enrolled: "bg-blue-100 text-blue-800 border-blue-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  withdrawn: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_LABEL: Record<string, string> = {
  passed: "Passed",
  enrolled: "Enrolled",
  failed: "Failed",
  withdrawn: "Withdrawn",
};

export default function CoursesClient({
  courses,
  history,
}: {
  courses: DBCourse[];
  history: HistoryRow[];
}) {
  const historyMap = useMemo(() => {
    const m = new Map<string, HistoryRow>();
    for (const h of history) m.set(h.course_id, h);
    return m;
  }, [history]);

  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const status = historyMap.get(c.course_id)?.status ?? "";
      if (filter === "passed" && status !== "passed") return false;
      if (filter === "enrolled" && status !== "enrolled") return false;
      if (filter === "none" && status !== "") return false;
      if (search && !c.course_na.includes(search) && !c.course_id.includes(search)) return false;
      return true;
    });
  }, [courses, historyMap, filter, search]);

  const statSummary = useMemo(() => {
    let passed = 0, enrolled = 0, none = 0;
    for (const c of courses) {
      const status = historyMap.get(c.course_id)?.status ?? "";
      if (status === "passed") passed++;
      else if (status === "enrolled") enrolled++;
      else none++;
    }
    return { passed, enrolled, none };
  }, [courses, historyMap]);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats bar */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: "Passed", count: statSummary.passed, color: "text-green-700" },
          { label: "Enrolled", count: statSummary.enrolled, color: "text-blue-700" },
          { label: "Not started", count: statSummary.none, color: "text-on-surface-variant" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-surface-container-low rounded-xl px-4 py-2 flex gap-2 items-center">
            <span className={`font-headline text-title-lg font-bold ${color}`}>{count}</span>
            <span className="font-body text-body-sm text-on-surface-variant">{label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="search"
          placeholder="Search course…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-48"
        />
        {["all", "passed", "enrolled", "none"].map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-full font-body text-body-sm border transition-all ${
              filter === v
                ? "bg-primary text-on-primary border-primary"
                : "border-outline-variant text-on-surface-variant hover:border-primary"
            }`}
          >
            {v === "none" ? "Not started" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Course table */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="font-body text-body-md text-on-surface-variant py-8 text-center">
            No courses match the filter.
          </p>
        )}
        {filtered.map((c) => {
          const row = historyMap.get(c.course_id);
          const status = row?.status ?? "";
          const badge = status ? STATUS_BADGE[status] : undefined;

          return (
            <div
              key={c.course_id}
              className="bg-surface-container-low rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1">
                <p className="font-headline text-title-sm font-bold" dir="rtl">
                  {c.course_na}
                </p>
                <p className="font-body text-body-sm text-on-surface-variant">
                  {c.course_id} · {c.credit_hours} cr ·{" "}
                  {c.semester_order ? `Sem ${c.semester_order}` : "—"}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {status ? (
                  <span
                    className={`text-xs font-semibold border rounded-full px-3 py-1 ${
                      badge ?? "border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    {STATUS_LABEL[status] ?? status}
                    {row?.grade != null ? ` · ${row.grade}` : ""}
                  </span>
                ) : (
                  <span className="text-xs font-semibold border border-outline-variant text-on-surface-variant rounded-full px-3 py-1">
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
