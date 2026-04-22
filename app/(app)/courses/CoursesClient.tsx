"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

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
type Semester = { semester_id: string; name: string; status: string };

const STATUS_OPTIONS = [
  { value: "", label: "—" },
  { value: "passed", label: "Passed" },
  { value: "enrolled", label: "Enrolled" },
  { value: "failed", label: "Failed" },
  { value: "withdrawn", label: "Withdrawn" },
];

const STATUS_BADGE: Record<string, string> = {
  passed: "bg-green-100 text-green-800 border-green-200",
  enrolled: "bg-blue-100 text-blue-800 border-blue-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  withdrawn: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function CoursesClient({
  stdId,
  courses,
  history,
  semesters,
}: {
  stdId: string;
  courses: DBCourse[];
  history: HistoryRow[];
  semesters: Semester[];
}) {
  const historyMap = useMemo(() => {
    const m = new Map<string, HistoryRow>();
    for (const h of history) m.set(h.course_id, h);
    return m;
  }, [history]);

  const [overrides, setOverrides] = useState<
    Map<string, { status: string; grade: string; semesterId: string }>
  >(new Map());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  function getOverride(id: string) {
    return (
      overrides.get(id) ?? {
        status: historyMap.get(id)?.status ?? "",
        grade: historyMap.get(id)?.grade?.toString() ?? "",
        semesterId: historyMap.get(id)?.semester_id ?? "",
      }
    );
  }

  function updateOverride(
    id: string,
    patch: Partial<{ status: string; grade: string; semesterId: string }>
  ) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, { ...getOverride(id), ...patch });
      return next;
    });
    setSaved((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  async function save(courseId: string) {
    const ov = getOverride(courseId);
    if (!ov.status) {
      // Delete record
      const supabase = createClient();
      setSaving((s) => new Set(s).add(courseId));
      await supabase
        .from("std_course")
        .delete()
        .eq("std_id", stdId)
        .eq("course_id", courseId);
      setSaving((s) => { const n = new Set(s); n.delete(courseId); return n; });
      setSaved((s) => new Set(s).add(courseId));
      return;
    }
    const supabase = createClient();
    setSaving((s) => new Set(s).add(courseId));
    const payload = {
      std_id: stdId,
      course_id: courseId,
      status: ov.status,
      grade: ov.grade ? parseFloat(ov.grade) : null,
      semester_id: ov.semesterId || null,
    };
    const { error } = await supabase
      .from("std_course")
      .upsert(payload, { onConflict: "std_id,course_id" });
    if (error) {
      setErrors((prev) => new Map(prev).set(courseId, error.message));
    } else {
      setSaved((s) => new Set(s).add(courseId));
    }
    setSaving((s) => { const n = new Set(s); n.delete(courseId); return n; });
  }

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const status = historyMap.get(c.course_id)?.status ?? overrides.get(c.course_id)?.status ?? "";
      if (filter === "passed" && status !== "passed") return false;
      if (filter === "enrolled" && status !== "enrolled") return false;
      if (filter === "none" && status !== "") return false;
      if (search && !c.course_na.includes(search) && !c.course_id.includes(search)) return false;
      return true;
    });
  }, [courses, historyMap, overrides, filter, search]);

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
          const ov = getOverride(c.course_id);
          const isSaving = saving.has(c.course_id);
          const isSaved = saved.has(c.course_id);
          const errMsg = errors.get(c.course_id);
          const badge = ov.status ? STATUS_BADGE[ov.status] : undefined;

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
                {/* Status badge / selector */}
                <select
                  value={ov.status}
                  onChange={(e) => updateOverride(c.course_id, { status: e.target.value })}
                  className={`text-xs font-semibold border rounded-full px-3 py-1 bg-transparent cursor-pointer transition-all ${
                    badge ?? "border-outline-variant text-on-surface-variant"
                  }`}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {/* Grade (only if passed/failed) */}
                {(ov.status === "passed" || ov.status === "failed") && (
                  <input
                    type="number"
                    placeholder="Grade"
                    min={0}
                    max={100}
                    value={ov.grade}
                    onChange={(e) => updateOverride(c.course_id, { grade: e.target.value })}
                    className="w-20 text-xs border border-outline-variant rounded-lg px-2 py-1"
                  />
                )}

                {/* Semester selector */}
                {semesters.length > 0 && ov.status && (
                  <select
                    value={ov.semesterId}
                    onChange={(e) => updateOverride(c.course_id, { semesterId: e.target.value })}
                    className="text-xs border border-outline-variant rounded-lg px-2 py-1 bg-transparent"
                  >
                    <option value="">Semester…</option>
                    {semesters.map((s) => (
                      <option key={s.semester_id} value={s.semester_id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => save(c.course_id)}
                  disabled={isSaving}
                  className="text-xs btn-secondary py-1 px-3"
                >
                  {isSaving ? "…" : isSaved ? "✓ Saved" : "Save"}
                </button>
              </div>
              {errMsg && (
                <p className="font-body text-body-xs text-red-600 w-full">{errMsg}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
