/**
 * Deterministic course-recommendation engine.
 *
 * Pure functions — no DB access. Feed it a plan (list of courses), a student's
 * history, and a target credit load; get back an ordered list of eligible picks
 * plus human-readable warnings.
 */

export type CourseType = "required" | "elective" | "university" | "faculty";

export type Course = {
  id: string;
  name: string;
  credits: number;
  type: CourseType;
  prereqIds: string[];       // strict prereqs only — must be passed before enrolling
  semesterOrder?: number | null;
};

export type StudentHistory = {
  passed: Set<string>;
  enrolled: Set<string>;     // currently taking (blocks re-enrollment)
  failed: Set<string>;       // can re-take
};

export type RecommendInput = {
  plan: Course[];
  history: StudentHistory;
  targetCredits: number;     // student-chosen load for the upcoming semester
  planTotalCredits?: number; // total credits required to graduate
};

export type RecommendResult = {
  picks: Course[];
  totalCredits: number;
  creditsCompleted: number;
  warnings: string[];
  eligibleCount: number;
  lockedByPrereq: Array<{ course: Course; missing: string[] }>;
};

/**
 * A course is eligible if:
 *   1. the student hasn't already passed it
 *   2. the student isn't already enrolled in it this semester
 *   3. every strict prereq has been passed
 */
export function eligibleCourses(plan: Course[], history: StudentHistory): Course[] {
  return plan.filter(
    (c) =>
      !history.passed.has(c.id) &&
      !history.enrolled.has(c.id) &&
      c.prereqIds.every((p) => history.passed.has(p))
  );
}

/**
 * Courses blocked *purely* by unmet prereqs — useful for UI "locked" badges.
 */
export function lockedByPrereq(
  plan: Course[],
  history: StudentHistory
): Array<{ course: Course; missing: string[] }> {
  return plan
    .filter((c) => !history.passed.has(c.id) && !history.enrolled.has(c.id))
    .map((c) => ({
      course: c,
      missing: c.prereqIds.filter((p) => !history.passed.has(p)),
    }))
    .filter((x) => x.missing.length > 0);
}

// Priority: required > faculty > university > elective.
// Within same type, prefer lower semesterOrder, then lower course id.
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

/**
 * Greedy pack: pick highest-priority eligible courses until adding the next
 * would overflow the target load. Explicitly prefers exact/closest fit.
 */
export function recommendForSemester(input: RecommendInput): RecommendResult {
  const { plan, history, targetCredits, planTotalCredits } = input;
  const warnings: string[] = [];

  if (targetCredits <= 0) warnings.push("Target credit hours must be greater than 0.");
  if (targetCredits > 18) warnings.push(`Target load ${targetCredits} exceeds the usual 18-hour maximum.`);

  const eligible = eligibleCourses(plan, history).sort(rank);
  const locked = lockedByPrereq(plan, history);

  const picks: Course[] = [];
  let total = 0;
  for (const c of eligible) {
    if (total + c.credits > targetCredits) continue;
    picks.push(c);
    total += c.credits;
    if (total === targetCredits) break;
  }

  if (picks.length === 0 && eligible.length > 0) {
    warnings.push(
      `No course fits within ${targetCredits} credits — smallest eligible course is ${eligible[0].credits} credits.`
    );
  }
  if (eligible.length === 0) {
    if (locked.length > 0) warnings.push(`No courses eligible yet — ${locked.length} course(s) waiting on prerequisites.`);
    else warnings.push("No courses remaining in this plan.");
  }

  const creditsCompleted = plan
    .filter((c) => history.passed.has(c.id))
    .reduce((sum, c) => sum + c.credits, 0);

  if (planTotalCredits && creditsCompleted >= planTotalCredits) {
    warnings.push("You have already completed the credit hours required for this plan.");
  }

  return {
    picks,
    totalCredits: total,
    creditsCompleted,
    warnings,
    eligibleCount: eligible.length,
    lockedByPrereq: locked,
  };
}
