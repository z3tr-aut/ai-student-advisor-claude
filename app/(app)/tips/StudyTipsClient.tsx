"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";

const FIXTURE_SCHEDULE_KEY = "studentSchedule:current";

export type AcceptedCourse = {
  courseId: string;
  courseName: string;
  courseNameAr?: string | null;
  credits: number;
};

export default function StudyTipsClient({
  mode,
  initialCourses,
}: {
  mode: "fixture" | "supabase";
  initialCourses: AcceptedCourse[];
}) {
  const { t, lang } = useI18n();
  const [courses, setCourses] = useState<AcceptedCourse[]>(initialCourses);
  const [hydrated, setHydrated] = useState(mode === "supabase");

  useEffect(() => {
    if (mode !== "fixture") return;
    try {
      const raw = window.localStorage.getItem(FIXTURE_SCHEDULE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          picks: Array<{
            course_id: string;
            course_name: string;
            credits: number;
          }>;
        };
        const seen = new Set<string>();
        const list: AcceptedCourse[] = [];
        for (const p of parsed.picks ?? []) {
          if (seen.has(p.course_id)) continue;
          seen.add(p.course_id);
          list.push({
            courseId: p.course_id,
            courseName: p.course_name,
            credits: p.credits,
          });
        }
        setCourses(list);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [mode]);

  const GENERIC_TIPS = [
    t("tips.generic.0"),
    t("tips.generic.1"),
    t("tips.generic.2"),
    t("tips.generic.3"),
  ];

  if (!hydrated) {
    return (
      <p className="font-body text-body-md text-on-surface-variant text-center py-12">
        {t("common.loading")}
      </p>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="advisor-card text-center py-16">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-surface-variant items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: "28px" }}>
            auto_awesome
          </span>
        </div>
        <h3 className="font-headline text-headline-sm text-on-surface mb-3">
          {t("tips.empty.title")}
        </h3>
        <p className="font-body text-body-md text-on-surface-variant max-w-md mx-auto mb-6">
          {t("tips.empty.body")}
        </p>
        <Link href="/chat" className="btn-primary inline-flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            chat_bubble
          </span>
          {t("common.openChat")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {courses.map((c, idx) => {
        const displayName = lang === "ar" && c.courseNameAr ? c.courseNameAr : c.courseName;
        return (
          <article
            key={c.courseId}
            className="bg-surface-container-low rounded-2xl p-5 flex flex-col gap-3"
          >
            <header>
              <p className="text-label-md font-semibold uppercase tracking-wider text-primary">
                {c.courseId} · {c.credits} {t("tips.creditSuffix")}
              </p>
              <h3 className="font-headline text-headline-sm text-on-surface mt-1">
                {displayName}
              </h3>
            </header>
            <ul className="font-body text-body-sm text-on-surface-variant flex flex-col gap-2 pl-4 list-disc">
              {[0, 1, 2].map((i) => (
                <li key={i}>{GENERIC_TIPS[(idx + i) % GENERIC_TIPS.length]}</li>
              ))}
            </ul>
            <Link
              href={`/chat?prompt=${encodeURIComponent(
                t("tips.askPromptTemplate", { course: displayName })
              )}`}
              className="btn-tertiary text-body-sm self-start mt-1"
            >
              {t("tips.askMore")}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
