import { describe, it, expect } from "vitest";
import {
  recommendSchedule,
  sectionsConflict,
  matchesPreferences,
} from "./schedule";
import type { Course, StudentHistory } from "./engine";
import type { Section } from "./fixtures/loader";

const mkCourse = (
  id: string,
  credits: number,
  prereqs: string[] = [],
  type: Course["type"] = "required"
): Course => ({
  id,
  name: `Course ${id}`,
  credits,
  type,
  prereqIds: prereqs,
  semesterOrder: null,
});

const mkSection = (
  id: string,
  courseId: string,
  day: Section["day"],
  start: string,
  end: string
): Section => {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return {
    id,
    courseId,
    day,
    startMinutes: toMin(start),
    endMinutes: toMin(end),
  };
};

const emptyHistory = (): StudentHistory => ({
  passed: new Set(),
  enrolled: new Set(),
  failed: new Set(),
});

describe("sectionsConflict", () => {
  it("flags overlapping sections on the same day", () => {
    const a = mkSection("a", "C1", "Sunday", "09:00", "10:30");
    const b = mkSection("b", "C2", "Sunday", "10:00", "11:00");
    expect(sectionsConflict(a, b)).toBe(true);
  });

  it("treats back-to-back sections as non-conflicting", () => {
    const a = mkSection("a", "C1", "Sunday", "08:00", "09:00");
    const b = mkSection("b", "C2", "Sunday", "09:00", "10:00");
    expect(sectionsConflict(a, b)).toBe(false);
  });

  it("never conflicts across different days", () => {
    const a = mkSection("a", "C1", "Sunday", "08:00", "10:00");
    const b = mkSection("b", "C2", "Monday", "08:00", "10:00");
    expect(sectionsConflict(a, b)).toBe(false);
  });
});

describe("matchesPreferences", () => {
  const s = mkSection("a", "C1", "Sunday", "08:00", "09:00");

  it("returns true when no prefs are given", () => {
    expect(matchesPreferences(s)).toBe(true);
  });

  it("filters out sections that start before earliestStart", () => {
    expect(matchesPreferences(s, { earliestStart: "09:00" })).toBe(false);
    expect(matchesPreferences(s, { earliestStart: "08:00" })).toBe(true);
  });

  it("filters out sections that end after latestEnd", () => {
    expect(matchesPreferences(s, { latestEnd: "08:30" })).toBe(false);
    expect(matchesPreferences(s, { latestEnd: "09:00" })).toBe(true);
  });

  it("filters out excluded days", () => {
    expect(matchesPreferences(s, { excludedDays: ["Sunday"] })).toBe(false);
    expect(matchesPreferences(s, { excludedDays: ["Monday"] })).toBe(true);
  });
});

describe("recommendSchedule", () => {
  it("greedy-packs eligible courses up to the target load", () => {
    const plan = [mkCourse("A", 4), mkCourse("B", 4), mkCourse("C", 4)];
    const sections = [
      mkSection("a1", "A", "Sunday", "08:00", "09:00"),
      mkSection("b1", "B", "Sunday", "09:00", "10:00"),
      mkSection("c1", "C", "Sunday", "10:00", "11:00"),
    ];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
    });
    expect(res.picks.map((p) => p.course.id).sort()).toEqual(["A", "B", "C"]);
    expect(res.totalCredits).toBe(12);
  });

  it("never picks two conflicting sections", () => {
    const plan = [mkCourse("A", 6), mkCourse("B", 6)];
    const sections = [
      mkSection("a1", "A", "Sunday", "08:00", "09:30"),
      mkSection("b1", "B", "Sunday", "09:00", "10:30"),
      mkSection("b2", "B", "Monday", "08:00", "09:30"),
    ];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
    });
    expect(res.picks).toHaveLength(2);
    expect(res.picks[0].section.id).toBe("a1");
    expect(res.picks[1].section.id).toBe("b2");
  });

  it("records 'all-conflict' when every section overlaps a pick", () => {
    const plan = [mkCourse("A", 6), mkCourse("B", 6)];
    const sections = [
      mkSection("a1", "A", "Sunday", "08:00", "10:00"),
      mkSection("b1", "B", "Sunday", "09:00", "10:00"),
    ];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
    });
    expect(res.picks.map((p) => p.course.id)).toEqual(["A"]);
    expect(res.unscheduled).toEqual([
      { course: plan[1], reason: "all-conflict" },
    ]);
  });

  it("records 'out-of-window' when prefs filter every section", () => {
    const plan = [mkCourse("A", 12)];
    const sections = [mkSection("a1", "A", "Sunday", "07:00", "08:00")];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
      preferences: { earliestStart: "08:00" },
    });
    expect(res.picks).toHaveLength(0);
    expect(res.unscheduled).toEqual([
      { course: plan[0], reason: "out-of-window" },
    ]);
  });

  it("records 'no-section' when a course has no offering", () => {
    const plan = [mkCourse("A", 6), mkCourse("B", 6)];
    const sections = [mkSection("a1", "A", "Sunday", "08:00", "09:00")];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
    });
    expect(res.picks.map((p) => p.course.id)).toEqual(["A"]);
    expect(res.unscheduled).toEqual([{ course: plan[1], reason: "no-section" }]);
  });

  it("respects prereq locking via the engine", () => {
    const plan = [mkCourse("A", 6), mkCourse("B", 6, ["A"])];
    const sections = [
      mkSection("a1", "A", "Sunday", "08:00", "09:00"),
      mkSection("b1", "B", "Monday", "08:00", "09:00"),
    ];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
    });
    expect(res.picks.map((p) => p.course.id)).toEqual(["A"]);
  });

  it("never picks a section that starts before earliestStart", () => {
    const plan = [mkCourse("A", 12)];
    const sections = [
      mkSection("a1", "A", "Sunday", "07:00", "08:00"),
      mkSection("a2", "A", "Sunday", "09:00", "10:00"),
    ];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
      preferences: { earliestStart: "08:00" },
    });
    expect(res.picks).toHaveLength(1);
    expect(res.picks[0].section.id).toBe("a2");
  });

  it("prioritizes required courses over electives", () => {
    const plan = [
      mkCourse("E1", 6, [], "elective"),
      mkCourse("R1", 6, [], "required"),
    ];
    const sections = [
      mkSection("e1", "E1", "Sunday", "08:00", "09:00"),
      mkSection("r1", "R1", "Sunday", "08:00", "09:00"),
    ];
    const res = recommendSchedule({
      plan,
      sections,
      history: emptyHistory(),
      targetCredits: 12,
    });
    expect(res.picks.map((p) => p.course.id)).toEqual(["R1"]);
  });
});
