/**
 * Integration tests: exercise both engines against the real JSON fixture data
 * staged under ./fixtures/data/. Validates that the loader produces shapes the
 * engine actually accepts, and that the engine behaves sensibly on a realistic
 * student transcript.
 *
 * The chosen subject is std_id 1001 — the first student in std_course.json,
 * majoring in AI (major_id 1).
 */
import { describe, it, expect } from "vitest";
import { recommendForSemester, lockedByPrereq } from "./engine";
import { recommendSchedule, sectionsConflict } from "./schedule";
import {
  buildStudentScenario,
  loadActiveSemester,
  loadFixtureCourses,
  loadFixtureSections,
  resolveStudentMajorId,
} from "./fixtures";

const STD_ID = 1001;

describe("fixture loader sanity", () => {
  it("loads courses with string ids, array prereqs, and known credit hours", () => {
    const all = loadFixtureCourses();
    expect(all.length).toBeGreaterThan(0);
    for (const c of all.slice(0, 5)) {
      expect(typeof c.id).toBe("string");
      expect(Array.isArray(c.prereqIds)).toBe(true);
      expect(typeof c.credits).toBe("number");
      expect(c.credits).toBeGreaterThan(0);
    }
  });

  it("scopes courses to a major when majorId is provided", () => {
    const ai = loadFixtureCourses(1);
    const cy = loadFixtureCourses(3);
    expect(ai.length).toBeGreaterThan(0);
    expect(cy.length).toBeGreaterThan(0);
    const aiIds = new Set(ai.map((c) => c.id));
    expect(cy.some((c) => aiIds.has(c.id))).toBe(false);
  });

  it("loads sections with minute-integer times and known days", () => {
    const sections = loadFixtureSections();
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections.slice(0, 5)) {
      expect(s.startMinutes).toBeGreaterThanOrEqual(0);
      expect(s.endMinutes).toBeGreaterThan(s.startMinutes);
      expect(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]).toContain(s.day);
    }
  });

  it("finds an active semester", () => {
    const sem = loadActiveSemester();
    expect(sem.status).toBe("active");
    expect(sem.name).toBeTruthy();
  });

  it("resolves the student's major from their history", () => {
    expect(resolveStudentMajorId(STD_ID)).toBe(1); // AI
  });
});

describe("recommendForSemester on real fixture data", () => {
  it("packs a 15-credit-hour semester for student 1001", () => {
    const { courses, history } = buildStudentScenario(STD_ID);
    const res = recommendForSemester({
      plan: courses,
      history,
      targetCredits: 15,
    });
    expect(res.totalCredits).toBeLessThanOrEqual(15);
    expect(res.totalCredits).toBeGreaterThan(0);
    expect(res.picks.length).toBeGreaterThan(0);
    for (const c of res.picks) {
      expect(history.passed.has(c.id)).toBe(false);
    }
  });

  it("never re-suggests a course the student has already passed", () => {
    const { courses, history } = buildStudentScenario(STD_ID);
    const res = recommendForSemester({
      plan: courses,
      history,
      targetCredits: 15,
    });
    const passedIds = [...history.passed];
    expect(passedIds.length).toBeGreaterThan(0);
    for (const c of res.picks) {
      expect(passedIds).not.toContain(c.id);
    }
  });

  it("reports completed credit hours equal to the sum of passed courses", () => {
    const { courses, history } = buildStudentScenario(STD_ID);
    const res = recommendForSemester({
      plan: courses,
      history,
      targetCredits: 15,
    });
    const expected = courses
      .filter((c) => history.passed.has(c.id))
      .reduce((s, c) => s + c.credits, 0);
    expect(res.creditsCompleted).toBe(expected);
  });

  it("surfaces locked-by-prereq courses (or none, if all prereqs are met)", () => {
    const { courses, history } = buildStudentScenario(STD_ID);
    const locked = lockedByPrereq(courses, history);
    for (const entry of locked) {
      expect(entry.missing.length).toBeGreaterThan(0);
      for (const m of entry.missing) {
        expect(history.passed.has(m)).toBe(false);
      }
    }
  });
});

describe("recommendSchedule on real fixture data", () => {
  it("produces non-conflicting picks with no class before 08:00", () => {
    const { courses, sections, history } = buildStudentScenario(STD_ID);
    const res = recommendSchedule({
      plan: courses,
      sections,
      history,
      targetCredits: 15,
      preferences: { earliestStart: "08:00" },
    });
    expect(res.totalCredits).toBeLessThanOrEqual(15);
    for (const p of res.picks) {
      expect(p.section.startMinutes).toBeGreaterThanOrEqual(8 * 60);
    }
    for (let i = 0; i < res.picks.length; i++) {
      for (let j = i + 1; j < res.picks.length; j++) {
        expect(sectionsConflict(res.picks[i].section, res.picks[j].section)).toBe(false);
      }
    }
  });

  it("filters Friday-style excluded days (Thursday in this dataset)", () => {
    const { courses, sections, history } = buildStudentScenario(STD_ID);
    const res = recommendSchedule({
      plan: courses,
      sections,
      history,
      targetCredits: 12,
      preferences: { excludedDays: ["Thursday"] },
    });
    for (const p of res.picks) {
      expect(p.section.day).not.toBe("Thursday");
    }
  });

  it("respects prereq + already-passed gates on real data", () => {
    const { courses, sections, history } = buildStudentScenario(STD_ID);
    const res = recommendSchedule({
      plan: courses,
      sections,
      history,
      targetCredits: 15,
    });
    for (const pick of res.picks) {
      expect(history.passed.has(pick.course.id)).toBe(false);
      for (const prereq of pick.course.prereqIds) {
        expect(history.passed.has(prereq)).toBe(true);
      }
    }
  });
});
