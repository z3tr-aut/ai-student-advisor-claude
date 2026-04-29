/**
 * Fixture loader: maps the academic JSON dataset (snake_case, numeric IDs,
 * "HH:MM:SS" time strings) into the engine's domain types (camelCase, string
 * IDs, minute integers).
 *
 * The JSON snapshot under ./data/ is a curated subset of a sister project's
 * university-scheduling data; we use it for offline tests of the rule engine.
 */
import type { Course, CourseType, StudentHistory } from "../engine";
import coursesJson from "./data/courses.json";
import scheduleJson from "./data/schedule.json";
import timeSlotsJson from "./data/time_slots.json";
import semestersJson from "./data/semesters.json";
import roomsJson from "./data/rooms.json";
import stdCourseJson from "./data/std_course.json";

export type Day = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday";

export type Section = {
  id: string;
  courseId: string;
  day: Day;
  startMinutes: number;
  endMinutes: number;
  roomId?: string;
  roomName?: string;
  instructorId?: string;
  instructorName?: string;
  capacity?: number;
};

export type Room = {
  id: string;
  name: string;
  capacity: number;
  type: string;
};

export type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type TimeSlot = {
  id: string;
  day: Day;
  startMinutes: number;
  endMinutes: number;
};

const VALID_DAYS: ReadonlySet<string> = new Set([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
]);

function toDay(raw: string): Day {
  const d = raw.trim();
  if (!VALID_DAYS.has(d)) {
    throw new Error(`Unrecognized day in fixture: ${JSON.stringify(raw)}`);
  }
  return d as Day;
}

// "08:00:00" or "08:00" → minutes from midnight.
function toMinutes(raw: string): number {
  const [hh, mm] = raw.split(":").map((n) => Number(n));
  return hh * 60 + mm;
}

// "08:00" → minutes (used for SchedulePreferences input parsing).
export function timeToMinutes(raw: string): number {
  return toMinutes(raw);
}

// JSON's `course_type` is a delivery format ("Lecture", "Lab"), not the
// required/elective taxonomy the engine uses. The dataset doesn't carry that
// distinction, so everything maps to "required" — priority sorting then
// degenerates to a tie-break by id, which matches existing engine behavior.
function toCourseType(_raw: string | null | undefined): CourseType {
  return "required";
}

function toPrereqIds(raw: number | string | null | undefined): string[] {
  if (raw === null || raw === undefined) return [];
  return [String(raw)];
}

type RawCourse = {
  course_id: number;
  course_name: string;
  course_name_ar?: string;
  credit_hours: number;
  course_type: string | null;
  major_id: number;
  major_name: string;
  prereq_id: number | null;
};

type RawSchedule = {
  schedule_id: number;
  course_id: number;
  course_name?: string;
  credit_hours?: number;
  instructor_id: number | null;
  instructor_name?: string | null;
  room_id: number | null;
  room_name?: string | null;
  time_id: number;
  day: string;
  start_time: string;
  end_time: string;
  capacity?: number;
};

type RawTimeSlot = {
  time_id: number;
  day: string;
  start_time: string;
  end_time: string;
};

type RawRoom = {
  room_id: number;
  room_name: string;
  capacity: number;
  room_type: string;
};

type RawSemester = {
  semester_id: number;
  semester_name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type RawStdCourse = {
  std_id: number;
  student_name?: string;
  course_id: number;
  course_name?: string;
  semester_id: number;
  grade?: string | null;
  status: string;
  section?: string | null;
};

const rawCourses = coursesJson as RawCourse[];
const rawSchedule = scheduleJson as RawSchedule[];
const rawTimeSlots = timeSlotsJson as RawTimeSlot[];
const rawRooms = roomsJson as RawRoom[];
const rawSemesters = semestersJson as RawSemester[];
const rawStdCourse = stdCourseJson as RawStdCourse[];

/** Return all courses; pass `majorId` to scope to a single major. */
export function loadFixtureCourses(majorId?: number | string): Course[] {
  const target = majorId !== undefined ? Number(majorId) : null;
  return rawCourses
    .filter((c) => target === null || c.major_id === target)
    .map((c) => ({
      id: String(c.course_id),
      name: c.course_name,
      nameAr: c.course_name_ar,
      credits: c.credit_hours,
      type: toCourseType(c.course_type),
      prereqIds: toPrereqIds(c.prereq_id),
      semesterOrder: null,
    }));
}

export function loadFixtureSections(): Section[] {
  return rawSchedule.map((s) => ({
    id: String(s.schedule_id),
    courseId: String(s.course_id),
    day: toDay(s.day),
    startMinutes: toMinutes(s.start_time),
    endMinutes: toMinutes(s.end_time),
    roomId: s.room_id !== null && s.room_id !== undefined ? String(s.room_id) : undefined,
    roomName: s.room_name ?? undefined,
    instructorId:
      s.instructor_id !== null && s.instructor_id !== undefined
        ? String(s.instructor_id)
        : undefined,
    instructorName: s.instructor_name ?? undefined,
    capacity: s.capacity,
  }));
}

export function loadFixtureTimeSlots(): TimeSlot[] {
  return rawTimeSlots.map((t) => ({
    id: String(t.time_id),
    day: toDay(t.day),
    startMinutes: toMinutes(t.start_time),
    endMinutes: toMinutes(t.end_time),
  }));
}

export function loadFixtureRooms(): Room[] {
  return rawRooms.map((r) => ({
    id: String(r.room_id),
    name: r.room_name,
    capacity: r.capacity,
    type: r.room_type,
  }));
}

export function loadFixtureSemesters(): Semester[] {
  return rawSemesters.map((s) => ({
    id: String(s.semester_id),
    name: s.semester_name,
    startDate: s.start_date,
    endDate: s.end_date,
    status: s.status,
  }));
}

export function loadActiveSemester(): Semester {
  const all = loadFixtureSemesters();
  const active = all.find((s) => s.status === "active") ?? all[0];
  if (!active) throw new Error("No semesters defined in fixture data.");
  return active;
}

export function loadFixtureHistory(stdId: number | string): StudentHistory {
  const target = Number(stdId);
  const passed = new Set<string>();
  const enrolled = new Set<string>();
  const failed = new Set<string>();
  for (const row of rawStdCourse) {
    if (row.std_id !== target) continue;
    const cid = String(row.course_id);
    if (row.status === "passed") passed.add(cid);
    else if (row.status === "enrolled") enrolled.add(cid);
    else if (row.status === "failed") failed.add(cid);
  }
  return { passed, enrolled, failed };
}

/**
 * Resolve a student's major by inspecting any course they've taken and looking
 * up its `major_id` in the course catalog. Returns null if the student has no
 * recorded history in the fixture.
 */
export function resolveStudentMajorId(stdId: number | string): number | null {
  const target = Number(stdId);
  const firstRow = rawStdCourse.find((r) => r.std_id === target);
  if (!firstRow) return null;
  const course = rawCourses.find((c) => c.course_id === firstRow.course_id);
  return course?.major_id ?? null;
}

export function resolveStudentMajorName(stdId: number | string): string | null {
  const target = Number(stdId);
  const firstRow = rawStdCourse.find((r) => r.std_id === target);
  if (!firstRow) return null;
  const course = rawCourses.find((c) => c.course_id === firstRow.course_id);
  return course?.major_name ?? null;
}

export function resolveStudentName(stdId: number | string): string | null {
  const target = Number(stdId);
  const row = rawStdCourse.find((r) => r.std_id === target && r.student_name);
  return row?.student_name ?? null;
}

export type TranscriptEntry = {
  courseId: string;
  courseName: string;
  credits: number;
  grade: string | null;
  status: string;
  semesterId: string;
};

export type CatalogRow = {
  sectionId: string;
  courseId: string;
  courseName: string;
  courseNameAr: string | null;
  creditHours: number;
  day: Day;
  startMinutes: number;
  endMinutes: number;
  roomName: string | null;
  instructorName: string | null;
  capacity: number;
  enrolledCount: number;
};

/**
 * Read-only catalog of every section offered in the active semester, joined
 * with course/room/instructor names and a count of currently-enrolled students.
 *
 * Enrollment counts come from std_course rows where status === "enrolled" and
 * the section identifier matches schedule_id. This is fixture-mode only;
 * Supabase mode computes the same aggregate server-side from the academic
 * tables.
 */
export function loadFixtureCatalogRows(): CatalogRow[] {
  const enrolledBySection = new Map<string, number>();
  for (const row of rawStdCourse) {
    if (row.status !== "enrolled") continue;
    if (!row.section) continue;
    const key = String(row.section);
    enrolledBySection.set(key, (enrolledBySection.get(key) ?? 0) + 1);
  }

  return rawSchedule.map((s) => {
    const sectionId = String(s.schedule_id);
    const course = rawCourses.find((c) => c.course_id === s.course_id);
    return {
      sectionId,
      courseId: String(s.course_id),
      courseName: s.course_name ?? course?.course_name ?? `Course ${s.course_id}`,
      courseNameAr: course?.course_name_ar ?? null,
      creditHours: s.credit_hours ?? course?.credit_hours ?? 0,
      day: toDay(s.day),
      startMinutes: toMinutes(s.start_time),
      endMinutes: toMinutes(s.end_time),
      roomName: s.room_name ?? null,
      instructorName: s.instructor_name ?? null,
      capacity: s.capacity ?? 0,
      enrolledCount: enrolledBySection.get(sectionId) ?? 0,
    };
  });
}

export function loadFixtureTranscript(stdId: number | string): TranscriptEntry[] {
  const target = Number(stdId);
  return rawStdCourse
    .filter((r) => r.std_id === target)
    .map((r) => {
      const course = rawCourses.find((c) => c.course_id === r.course_id);
      return {
        courseId: String(r.course_id),
        courseName: r.course_name ?? course?.course_name ?? `Course ${r.course_id}`,
        credits: course?.credit_hours ?? 0,
        grade: r.grade ?? null,
        status: r.status,
        semesterId: String(r.semester_id),
      };
    });
}
