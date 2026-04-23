import { describe, it, expect } from "vitest";
import {
  eligibleCourses,
  lockedByPrereq,
  recommendForSemester,
  type Course,
  type StudentHistory,
} from "./engine";

const mk = (id: string, credits: number, prereqs: string[] = [], type: Course["type"] = "required"): Course => ({
  id,
  name: `Course ${id}`,
  credits,
  type,
  prereqIds: prereqs,
  semesterOrder: null,
});

const emptyHistory = (): StudentHistory => ({
  passed: new Set(),
  enrolled: new Set(),
  failed: new Set(),
});

describe("eligibleCourses", () => {
  it("returns all courses with no prereqs when history is empty", () => {
    const plan = [mk("A", 3), mk("B", 3), mk("C", 3, ["A"])];
    const res = eligibleCourses(plan, emptyHistory());
    expect(res.map((c) => c.id).sort()).toEqual(["A", "B"]);
  });

  it("excludes courses already passed or enrolled", () => {
    const plan = [mk("A", 3), mk("B", 3), mk("C", 3)];
    const h = emptyHistory();
    h.passed.add("A");
    h.enrolled.add("B");
    const res = eligibleCourses(plan, h);
    expect(res.map((c) => c.id)).toEqual(["C"]);
  });

  it("unlocks courses once prereqs are passed", () => {
    const plan = [mk("A", 3), mk("B", 3, ["A"]), mk("C", 3, ["A", "B"])];
    const h = emptyHistory();
    h.passed.add("A");
    const res = eligibleCourses(plan, h);
    expect(res.map((c) => c.id)).toEqual(["B"]);
  });
});

describe("lockedByPrereq", () => {
  it("reports missing prereqs", () => {
    const plan = [mk("A", 3), mk("B", 3, ["A"]), mk("C", 3, ["A", "B"])];
    const h = emptyHistory();
    const locked = lockedByPrereq(plan, h);
    expect(locked).toHaveLength(2);
    expect(locked.find((l) => l.course.id === "C")!.missing.sort()).toEqual(["A", "B"]);
  });
});

describe("recommendForSemester", () => {
  it("greedy-packs within the target load", () => {
    const plan = [mk("A", 3), mk("B", 3), mk("C", 3), mk("D", 3), mk("E", 3), mk("F", 3)];
    const res = recommendForSemester({ plan, history: emptyHistory(), targetCredits: 15 });
    expect(res.totalCredits).toBe(15);
    expect(res.picks).toHaveLength(5);
  });

  it("never exceeds the target load", () => {
    const plan = [mk("A", 4), mk("B", 4), mk("C", 4), mk("D", 4)];
    const res = recommendForSemester({ plan, history: emptyHistory(), targetCredits: 15 });
    expect(res.totalCredits).toBeLessThanOrEqual(15);
    expect(res.totalCredits).toBe(12);
  });

  it("warns when target exceeds 18", () => {
    const plan = [mk("A", 3)];
    const res = recommendForSemester({ plan, history: emptyHistory(), targetCredits: 21 });
    expect(res.warnings.some((w) => /18/.test(w))).toBe(true);
  });

  it("never re-suggests a completed course", () => {
    const plan = [mk("A", 3), mk("B", 3)];
    const h = emptyHistory();
    h.passed.add("A");
    const res = recommendForSemester({ plan, history: h, targetCredits: 15 });
    expect(res.picks.find((c) => c.id === "A")).toBeUndefined();
    expect(res.picks.find((c) => c.id === "B")).toBeDefined();
  });

  it("prioritizes required courses over electives", () => {
    const plan = [
      mk("E1", 3, [], "elective"),
      mk("U1", 3, [], "university"),
      mk("R1", 3, [], "required"),
      mk("F1", 3, [], "faculty"),
    ];
    const res = recommendForSemester({ plan, history: emptyHistory(), targetCredits: 3 });
    expect(res.picks[0].id).toBe("R1");
  });

  it("warns when nothing fits in a tiny target load", () => {
    const plan = [mk("A", 4)];
    const res = recommendForSemester({ plan, history: emptyHistory(), targetCredits: 3 });
    expect(res.picks).toEqual([]);
    expect(res.warnings.some((w) => /fit/i.test(w))).toBe(true);
  });

  it("reports completed credit hours", () => {
    const plan = [mk("A", 3), mk("B", 3)];
    const h = emptyHistory();
    h.passed.add("A");
    const res = recommendForSemester({ plan, history: h, targetCredits: 15, planTotalCredits: 6 });
    expect(res.creditsCompleted).toBe(3);
  });

  it("flags completion when all required credits are met", () => {
    const plan = [mk("A", 3), mk("B", 3)];
    const h = emptyHistory();
    h.passed.add("A");
    h.passed.add("B");
    const res = recommendForSemester({ plan, history: h, targetCredits: 15, planTotalCredits: 6 });
    expect(res.warnings.some((w) => /completed/i.test(w))).toBe(true);
  });
});
