/**
 * Time-slot-aware scheduling extension.
 *
 * Builds on the prereq + credit-load engine in ./engine.ts: reuses the
 * eligibility filter and priority sort, then adds section selection with
 * conflict detection and time-window preferences.
 *
 * Pure functions, DB-free — feed it a plan, sections, history, target load,
 * and (optional) preferences; get back picks tied to specific sections.
 */
import {
  eligibleCourses,
  type Course,
  type CourseType,
  type StudentHistory,
} from "./engine";
import type { Day, Section } from "./fixtures/loader";
import { timeToMinutes } from "./fixtures/loader";

export type SchedulePreferences = {
  earliestStart?: string;   // "HH:MM" — section.startMinutes must be >= this
  latestEnd?: string;       // "HH:MM" — section.endMinutes must be <= this
  excludedDays?: Day[];
};

export type SchedulePick = {
  course: Course;
  section: Section;
};

export type UnscheduledReason = "no-section" | "all-conflict" | "out-of-window";

export type ScheduleResult = {
  picks: SchedulePick[];
  totalCredits: number;
  warnings: string[];
  unscheduled: Array<{ course: Course; reason: UnscheduledReason }>;
};

export type ScheduleInput = {
  plan: Course[];
  sections: Section[];
  history: StudentHistory;
  targetCredits: number;
  preferences?: SchedulePreferences;
};

const TYPE_WEIGHT: Record<CourseType, number> = {
  required: 0,
  faculty: 1,
  university: 2,
  elective: 3,
};

function rank(a: Course, b: Course): number {
  const d = TYPE_WEIGHT[a.type] - TYPE_WEIGHT[b.type];
  if (d) return d;
  const so = (a.semesterOrder ?? 99) - (b.semesterOrder ?? 99);
  if (so) return so;
  return a.id.localeCompare(b.id);
}

/** Two sections conflict if they share a day and their minute ranges overlap. */
export function sectionsConflict(a: Section, b: Section): boolean {
  if (a.day !== b.day) return false;
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export function matchesPreferences(s: Section, p?: SchedulePreferences): boolean {
  if (!p) return true;
  if (p.earliestStart && s.startMinutes < timeToMinutes(p.earliestStart)) return false;
  if (p.latestEnd && s.endMinutes > timeToMinutes(p.latestEnd)) return false;
  if (p.excludedDays && p.excludedDays.includes(s.day)) return false;
  return true;
}

const DAY_ORDER: Record<Day, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
};

function sectionOrder(a: Section, b: Section): number {
  const d = DAY_ORDER[a.day] - DAY_ORDER[b.day];
  if (d) return d;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.id.localeCompare(b.id);
}

/**
 * Greedy scheduler:
 *   1. Find eligible courses (delegates to engine.ts).
 *   2. Walk them in priority order.
 *   3. For each course, pick the first section that fits prefs, doesn't
 *      conflict with already-picked sections, and doesn't overflow the load.
 *   4. Record courses we couldn't schedule, with a reason.
 */
export function recommendSchedule(input: ScheduleInput): ScheduleResult {
  const { plan, sections, history, targetCredits, preferences } = input;
  const warnings: string[] = [];

  if (targetCredits <= 0) warnings.push("Target credit hours must be greater than 0.");
  if (targetCredits > 18) warnings.push(`Target load ${targetCredits} exceeds the usual 18-hour maximum.`);

  const eligible = eligibleCourses(plan, history).sort(rank);

  const sectionsByCourse = new Map<string, Section[]>();
  for (const s of sections) {
    const list = sectionsByCourse.get(s.courseId) ?? [];
    list.push(s);
    sectionsByCourse.set(s.courseId, list);
  }
  for (const list of sectionsByCourse.values()) list.sort(sectionOrder);

  const picks: SchedulePick[] = [];
  const unscheduled: ScheduleResult["unscheduled"] = [];
  let total = 0;

  for (const course of eligible) {
    if (total + course.credits > targetCredits) continue;

    const offered = sectionsByCourse.get(course.id) ?? [];
    if (offered.length === 0) {
      unscheduled.push({ course, reason: "no-section" });
      continue;
    }

    const inWindow = offered.filter((s) => matchesPreferences(s, preferences));
    if (inWindow.length === 0) {
      unscheduled.push({ course, reason: "out-of-window" });
      continue;
    }

    const noConflict = inWindow.find(
      (s) => !picks.some((p) => sectionsConflict(p.section, s))
    );
    if (!noConflict) {
      unscheduled.push({ course, reason: "all-conflict" });
      continue;
    }

    picks.push({ course, section: noConflict });
    total += course.credits;
    if (total === targetCredits) break;
  }

  if (picks.length === 0 && eligible.length > 0) {
    warnings.push(
      `No course fits within ${targetCredits} credits — smallest eligible course is ${eligible[0].credits} credits.`
    );
  }
  if (eligible.length === 0) {
    warnings.push("No courses are currently eligible for this student.");
  }

  return { picks, totalCredits: total, warnings, unscheduled };
}
