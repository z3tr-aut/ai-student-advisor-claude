"use client";

import { useState } from "react";
import Link from "next/link";
import type { StudentContext } from "@/lib/advisor/select";
import type { Course, RecommendResult } from "@/lib/advisor/engine";

type Outcome = {
  student: StudentContext;
  result: RecommendResult;
};

export default function AdvisorClient({ student }: { student: StudentContext }) {
  const [targetCredits, setTargetCredits] = useState(15);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRecommend() {
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      const res = await fetch("/api/advisor/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCredits }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unknown error");
      } else {
        setOutcome(json as Outcome);
      }
    } catch {
      setError("Failed to contact advisor API.");
    } finally {
      setLoading(false);
    }
  }

  const progress = student.plan_total_credits > 0
    ? Math.min(100, Math.round(((outcome?.result.creditsCompleted ?? 0) / student.plan_total_credits) * 100))
    : 0;

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-display-sm text-on-surface font-bold mb-1">
          Course Advisor
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant">
          {student.major_na} — {student.plan_id}
        </p>
      </div>

      {/* Progress bar */}
      {outcome && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between font-body text-body-sm text-on-surface-variant">
            <span>{outcome.result.creditsCompleted} credits completed</span>
            <span>{student.plan_total_credits} required</span>
          </div>
          <div className="h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="font-body text-body-sm text-on-surface-variant text-right">
            {progress}% complete
          </p>
        </div>
      )}

      {/* Credit slider */}
      <div className="bg-surface-container-low rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-headline text-title-md text-on-surface">
            Target load next semester
          </span>
          <span className="font-headline text-title-lg text-primary font-bold">
            {targetCredits} credits
          </span>
        </div>
        <input
          type="range"
          min={3}
          max={24}
          step={1}
          value={targetCredits}
          onChange={(e) => setTargetCredits(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between font-body text-label-md text-on-surface-variant">
          <span>3</span>
          <span className={targetCredits > 18 ? "text-red-500 font-semibold" : ""}>
            {targetCredits > 18 ? "⚠ exceeds typical max (18)" : ""}
          </span>
          <span>24</span>
        </div>
        <button
          onClick={onRecommend}
          disabled={loading}
          className="btn-primary self-start mt-2"
        >
          {loading ? "Computing…" : "Recommend courses"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 font-body text-body-md text-red-700">
          {error}
          {error.includes("onboarding") && (
            <Link href="/onboarding" className="ml-2 underline">
              Go to onboarding
            </Link>
          )}
        </div>
      )}

      {/* Results */}
      {outcome && (
        <div className="flex flex-col gap-4">
          {/* Warnings */}
          {outcome.result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-1">
              {outcome.result.warnings.map((w, i) => (
                <p key={i} className="font-body text-body-sm text-amber-800">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          <h2 className="font-headline text-headline-sm text-on-surface font-bold">
            Recommended picks ({outcome.result.totalCredits} credits)
          </h2>

          {outcome.result.picks.length === 0 ? (
            <p className="font-body text-body-md text-on-surface-variant">
              No courses fit the target load or none remain. Check your course history or adjust the slider.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {outcome.result.picks.map((c) => (
                <CoursePill key={c.id} course={c} />
              ))}
            </div>
          )}

          {/* Stats footer */}
          <p className="font-body text-body-sm text-on-surface-variant mt-2">
            {outcome.result.eligibleCount} courses eligible ·{" "}
            {outcome.result.lockedByPrereq.length} waiting on prerequisites
            {outcome.result.lockedByPrereq.length > 0 && (
              <>
                {" · first: "}
                <span className="font-semibold">
                  {outcome.result.lockedByPrereq[0].course.name}
                </span>{" "}
                (needs {outcome.result.lockedByPrereq[0].missing.join(", ")})
              </>
            )}
          </p>

          <Link
            href="/courses"
            className="btn-secondary self-start mt-2"
          >
            Manage course history →
          </Link>
        </div>
      )}
    </div>
  );
}

function CoursePill({ course }: { course: Course }) {
  const typeColors: Record<string, string> = {
    required: "bg-blue-50 border-blue-200 text-blue-800",
    faculty: "bg-purple-50 border-purple-200 text-purple-800",
    university: "bg-green-50 border-green-200 text-green-800",
    elective: "bg-orange-50 border-orange-200 text-orange-800",
  };
  const color = typeColors[course.type] ?? typeColors.required;
  return (
    <div className={`border rounded-2xl p-4 flex items-start gap-4 ${color}`}>
      <div className="flex-1">
        <p className="font-headline text-title-sm font-bold" dir="rtl">
          {course.name}
        </p>
        <p className="font-body text-body-sm mt-0.5">
          {course.id} · {course.credits} credit{course.credits !== 1 ? "s" : ""} ·{" "}
          <span className="capitalize">{course.type}</span>
        </p>
      </div>
    </div>
  );
}
