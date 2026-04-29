"use client";

import { useMemo, useState } from "react";
import type { CatalogRow } from "@/lib/advisor/fixtures";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { localizedDay } from "@/lib/i18n/dict";

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as const;
type DayFilter = "all" | (typeof DAY_ORDER)[number];

function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function SemesterScheduleClient({ rows }: { rows: CatalogRow[] }) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (dayFilter === "all" ? true : r.day === dayFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.courseName.toLowerCase().includes(q) ||
          r.courseId.toLowerCase().includes(q) ||
          (r.instructorName ?? "").toLowerCase().includes(q) ||
          (r.roomName ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
        if (dayDiff !== 0) return dayDiff;
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
        return a.courseName.localeCompare(b.courseName);
      });
  }, [rows, search, dayFilter]);

  const distinctCourses = useMemo(
    () => new Set(rows.map((r) => r.courseId)).size,
    [rows]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 flex-wrap">
        <Stat label={t("semester.stat.sections")} value={rows.length} />
        <Stat label={t("semester.stat.courses")} value={distinctCourses} />
        <Stat label={t("semester.stat.showing")} value={filtered.length} dimmed />
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="search"
          placeholder={t("semester.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-64"
        />
        <select
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value as DayFilter)}
          className="text-sm border border-outline-variant rounded-lg px-3 py-2 bg-surface"
        >
          <option value="all">{t("semester.allDays")}</option>
          {DAY_ORDER.map((d) => (
            <option key={d} value={d}>
              {localizedDay(d, lang)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="font-body text-body-md text-on-surface-variant py-8 text-center">
            {t("semester.noResults")}
          </p>
        )}
        {filtered.map((r) => (
          <SectionCard key={r.sectionId} row={r} lang={lang} t={t} />
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  dimmed,
}: {
  label: string;
  value: number;
  dimmed?: boolean;
}) {
  return (
    <div className="bg-surface-container-low rounded-xl px-4 py-2 flex gap-2 items-center">
      <span
        className={`font-headline text-title-lg font-bold ${
          dimmed ? "text-on-surface-variant" : "text-primary"
        }`}
      >
        {value}
      </span>
      <span className="font-body text-body-sm text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

function SectionCard({
  row,
  lang,
  t,
}: {
  row: CatalogRow;
  lang: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const seatsLeft = Math.max(0, row.capacity - row.enrolledCount);
  const fillPct =
    row.capacity > 0 ? Math.min(100, Math.round((row.enrolledCount / row.capacity) * 100)) : 0;
  const fillColor =
    fillPct >= 95 ? "bg-red-500" : fillPct >= 75 ? "bg-amber-500" : "bg-green-500";
  const displayName = lang === "ar" && row.courseNameAr ? row.courseNameAr : row.courseName;

  return (
    <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="font-headline text-title-md font-bold truncate">
            {displayName}
          </p>
          <span className="font-body text-body-sm text-on-surface-variant">
            #{row.sectionId} · {row.creditHours} cr
          </span>
        </div>
        <p className="font-body text-body-sm text-on-surface-variant mt-1">
          {row.instructorName ?? t("myschedule.instructorTBA")} ·{" "}
          {row.roomName ?? t("common.tba")}
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="font-headline text-title-sm font-semibold">{localizedDay(row.day, lang as "en" | "ar")}</p>
          <p className="font-body text-body-sm text-on-surface-variant">
            {fmtTime(row.startMinutes)}–{fmtTime(row.endMinutes)}
          </p>
        </div>
        <div className="w-32">
          <p className="font-body text-body-xs text-on-surface-variant text-right mb-1">
            {row.enrolledCount}/{row.capacity}{" "}
            <span className="text-on-surface-variant/60">
              · {t("semester.seatsLeft", { count: seatsLeft })}
            </span>
          </p>
          <div className="h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className={`h-full rounded-full ${fillColor}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
