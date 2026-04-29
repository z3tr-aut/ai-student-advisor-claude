"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { SchedulePick } from "@/lib/advisor/chat-payload";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { localizedDay } from "@/lib/i18n/dict";

const FIXTURE_SCHEDULE_KEY = "studentSchedule:current";

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as const;

type Row = SchedulePick;

type Props = {
  mode: "fixture" | "supabase";
  initialRows: Row[];
  totalCredits: number;
};

export default function MyScheduleClient({ mode, initialRows, totalCredits }: Props) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [credits, setCredits] = useState<number>(totalCredits);
  const [discard, setDiscard] = useState<{ open: boolean; busy: boolean }>({
    open: false,
    busy: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(mode === "supabase");

  useEffect(() => {
    if (mode !== "fixture") return;
    try {
      const raw = window.localStorage.getItem(FIXTURE_SCHEDULE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          picks: Row[];
          totalCredits: number;
        };
        setRows(parsed.picks ?? []);
        setCredits(parsed.totalCredits ?? 0);
      }
    } catch {
      // ignore corrupt localStorage
    }
    setHydrated(true);
  }, [mode]);

  async function confirmDiscard() {
    setDiscard({ open: true, busy: true });
    try {
      const res = await fetch("/api/schedule/accept", { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not discard");
      if (mode === "fixture" && typeof window !== "undefined") {
        window.localStorage.removeItem(FIXTURE_SCHEDULE_KEY);
      }
      setRows([]);
      setCredits(0);
      setDiscard({ open: false, busy: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Discard failed";
      setError(msg);
      setDiscard({ open: false, busy: false });
    }
  }

  if (!hydrated) {
    return (
      <p className="font-body text-body-md text-on-surface-variant text-center py-12">
        {t("common.loading")}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="advisor-card text-center py-16">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-surface-variant items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: "28px" }}>
            event_available
          </span>
        </div>
        <h3 className="font-headline text-headline-sm text-on-surface mb-3">
          {t("myschedule.empty.title")}
        </h3>
        <p className="font-body text-body-md text-on-surface-variant max-w-md mx-auto mb-6">
          {t("myschedule.empty.body")}
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

  const sorted = [...rows].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day as (typeof DAY_ORDER)[number]) -
      DAY_ORDER.indexOf(b.day as (typeof DAY_ORDER)[number]);
    if (dayDiff !== 0) return dayDiff;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 font-body text-body-md text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="font-body text-body-md text-on-surface-variant">
          {t("myschedule.summary", { count: rows.length, credits })}
        </p>
        <div className="flex gap-2">
          <Link
            href={`/chat?prompt=${encodeURIComponent(t("myschedule.editPrompt"))}`}
            className="btn-secondary text-body-sm py-2 px-4"
          >
            {t("myschedule.editInChat")}
          </Link>
          <button
            type="button"
            onClick={() => setDiscard({ open: true, busy: false })}
            className="btn-secondary text-body-sm py-2 px-4 text-red-700"
          >
            {t("myschedule.discard")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((r) => (
          <div
            key={r.schedule_id}
            className="bg-surface-container-low rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-headline text-title-md font-bold truncate">
                {r.course_name}
              </p>
              <p className="font-body text-body-sm text-on-surface-variant mt-1">
                {r.instructor_name ?? t("myschedule.instructorTBA")} ·{" "}
                {r.room_name
                  ? t("myschedule.roomLabel", { name: r.room_name })
                  : r.room_id
                  ? t("myschedule.roomLabel", { name: r.room_id })
                  : t("myschedule.roomTBA")}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-headline text-title-sm font-semibold">{localizedDay(r.day, lang)}</p>
              <p className="font-body text-body-sm text-on-surface-variant">
                {r.start_time}–{r.end_time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={discard.open}
        title={t("myschedule.discardDialog.title")}
        body={
          <p>{t("myschedule.discardDialog.body", { count: rows.length })}</p>
        }
        confirmLabel={t("myschedule.discard")}
        cancelLabel={t("common.keepIt")}
        destructive
        busy={discard.busy}
        onConfirm={confirmDiscard}
        onCancel={() => !discard.busy && setDiscard({ open: false, busy: false })}
      />
    </div>
  );
}
