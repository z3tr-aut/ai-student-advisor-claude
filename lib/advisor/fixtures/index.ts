/**
 * Convenience scenario builders for tests. Hides the loader plumbing so test
 * files can ask for a single student's full state in one call.
 */
import type { Course, StudentHistory } from "../engine";
import {
  loadFixtureCourses,
  loadFixtureSections,
  loadFixtureHistory,
  loadFixtureTranscript,
  resolveStudentMajorId,
  resolveStudentMajorName,
  resolveStudentName,
  type Section,
  type TranscriptEntry,
} from "./loader";

export type StudentScenario = {
  stdId: string;
  majorId: number | null;
  courses: Course[];     // plan scoped to the student's major
  history: StudentHistory;
  sections: Section[];   // sections offered for any course in the student's plan
};

export function buildStudentScenario(stdId: number | string): StudentScenario {
  const majorId = resolveStudentMajorId(stdId);
  const courses = loadFixtureCourses(majorId ?? undefined);
  const courseIds = new Set(courses.map((c) => c.id));
  const sections = loadFixtureSections().filter((s) => courseIds.has(s.courseId));
  return {
    stdId: String(stdId),
    majorId,
    courses,
    history: loadFixtureHistory(stdId),
    sections,
  };
}

export type StudentAcademicProfile = {
  stdId: string;
  studentName: string | null;
  majorId: number | null;
  majorName: string | null;
  creditsCompleted: number;
  approxYear: number;          // 1..6, derived from credits / 30
  passedCount: number;
  enrolledCount: number;
  failedCount: number;
  transcript: TranscriptEntry[];
};

/**
 * Pulls a rich academic snapshot for a fixture student — used to seed the
 * chat system prompt so the bot can answer "what's my major" / "what have I
 * passed" / "make me a schedule" without asking onboarding questions.
 */
export function buildStudentProfile(stdId: number | string): StudentAcademicProfile {
  const transcript = loadFixtureTranscript(stdId);
  const passed = transcript.filter((t) => t.status === "passed");
  const enrolled = transcript.filter((t) => t.status === "enrolled");
  const failed = transcript.filter((t) => t.status === "failed");
  const creditsCompleted = passed.reduce((sum, t) => sum + t.credits, 0);
  // Rough year estimate: ~30 credits per academic year, capped at 6.
  const approxYear = Math.min(6, Math.max(1, Math.ceil(creditsCompleted / 30) || 1));
  return {
    stdId: String(stdId),
    studentName: resolveStudentName(stdId),
    majorId: resolveStudentMajorId(stdId),
    majorName: resolveStudentMajorName(stdId),
    creditsCompleted,
    approxYear,
    passedCount: passed.length,
    enrolledCount: enrolled.length,
    failedCount: failed.length,
    transcript,
  };
}

export {
  loadFixtureCourses,
  loadFixtureSections,
  loadFixtureRooms,
  loadFixtureSemesters,
  loadFixtureTimeSlots,
  loadFixtureHistory,
  loadFixtureTranscript,
  loadFixtureCatalogRows,
  loadActiveSemester,
  resolveStudentMajorId,
  resolveStudentMajorName,
  resolveStudentName,
  timeToMinutes,
  type Section,
  type Room,
  type Semester,
  type TimeSlot,
  type Day,
  type TranscriptEntry,
  type CatalogRow,
} from "./loader";
