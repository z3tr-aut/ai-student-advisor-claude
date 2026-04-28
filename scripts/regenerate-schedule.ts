/**
 * One-shot generator for lib/advisor/fixtures/data/schedule.json.
 *
 * Reads courses.json, time_slots.json, rooms.json and produces a section
 * roster where:
 *   - every course has at least one section,
 *   - "popular" upper-level courses have 2–3 sections at different times,
 *   - sections are distributed across the 16 time slots in round-robin
 *     order, so no single slot becomes a conflict pile-up.
 *
 * Re-run any time the catalog changes:
 *   npx tsx scripts/regenerate-schedule.ts
 */
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join("lib", "advisor", "fixtures", "data");

type RawCourse = {
  course_id: number;
  course_name: string;
  credit_hours: number;
  major_id: number;
  major_name: string;
  prereq_id: number | null;
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

const courses: RawCourse[] = JSON.parse(
  fs.readFileSync(path.join(dataDir, "courses.json"), "utf8")
);
const slots: RawTimeSlot[] = JSON.parse(
  fs.readFileSync(path.join(dataDir, "time_slots.json"), "utf8")
);
const rooms: RawRoom[] = JSON.parse(
  fs.readFileSync(path.join(dataDir, "rooms.json"), "utf8")
);

const instructors: Array<{ instructor_id: number; instructor_name: string }> = [
  { instructor_id: 1, instructor_name: "Dr Ahmed Salem" },
  { instructor_id: 2, instructor_name: "Dr Mohammad Hassan" },
  { instructor_id: 3, instructor_name: "Dr Lina Khaled" },
  { instructor_id: 4, instructor_name: "Dr Omar Nasser" },
  { instructor_id: 5, instructor_name: "Dr Yousef Ali" },
  { instructor_id: 6, instructor_name: "Dr Rana Majed" },
  { instructor_id: 7, instructor_name: "Dr Khaled Sami" },
  { instructor_id: 8, instructor_name: "Dr Nour Hussein" },
  { instructor_id: 9, instructor_name: "Dr Sara Adel" },
  { instructor_id: 10, instructor_name: "Dr Mahmoud Zein" },
  { instructor_id: 11, instructor_name: "Dr Huda Farouq" },
  { instructor_id: 12, instructor_name: "Dr Anas Karim" },
];

// Courses with high enrollment in fixtures get 3 sections; mid-tier 2; rest 1.
// Popularity heuristic: courses with no prereq AND those that are foundational.
function sectionCountFor(c: RawCourse): number {
  // Foundational + capstone-ish courses get more sections.
  const popular: Record<number, number> = {
    // AI core
    33: 3, // Machine Learning
    34: 2, // Computer Vision
    35: 2, // NLP
    36: 2, // Deep Learning
    37: 2, // Reinforcement Learning
    38: 2, // AI Ethics
    39: 3, // Calculus for AI
    40: 2, // Research Methods
    41: 2, // Technical Writing
    42: 2, // AI Graduation Project
    // SE core
    20: 2, // Software Design
    21: 2, // Database Systems
    22: 2, // Software Testing
    23: 2, // Web Development
    25: 2, // Software Architecture
    27: 2, // Software Project Management
    // CY core
    8: 2,  // Operating Systems
    9: 2,  // Network Security
    10: 2, // Cryptography
    12: 2, // Secure Software Development
    // shared earlier-year
    2: 2,  // Programming 2 (CY)
    18: 2, // Programming 2 (SE)
    29: 2, // Programming 2 (AI)
    4: 2,  // Intro Cyber Security
    7: 2,  // Networking Fundamentals
    31: 2, // Probability and Statistics
    32: 2, // Data Mining
  };
  return popular[c.course_id] ?? 1;
}

type Section = {
  schedule_id: number;
  course_name: string;
  credit_hours: number;
  instructor_name: string;
  room_name: string;
  capacity: number;
  day: string;
  start_time: string;
  end_time: string;
  course_id: number;
  instructor_id: number;
  room_id: number;
  time_id: number;
};

const out: Section[] = [];
let nextScheduleId = 1;

// Round-robin pointers seeded so the first few sections don't all hit slot 1.
let slotCursor = 0;
let instructorCursor = 0;
let roomCursor = 0;

// Sort courses by major then id so each major's sections distribute across the
// week instead of one major hogging early slots.
const ordered = [...courses].sort((a, b) => {
  if (a.major_id !== b.major_id) return a.major_id - b.major_id;
  return a.course_id - b.course_id;
});

for (const course of ordered) {
  const n = sectionCountFor(course);
  const usedSlotsForCourse = new Set<number>();
  for (let i = 0; i < n; i++) {
    // Find next slot we haven't already used for THIS course (so a course
    // never has two sections at the exact same day+time).
    let attempts = 0;
    while (usedSlotsForCourse.has(slots[slotCursor % slots.length].time_id) && attempts < slots.length) {
      slotCursor = (slotCursor + 1) % slots.length;
      attempts++;
    }
    const slot = slots[slotCursor % slots.length];
    usedSlotsForCourse.add(slot.time_id);
    slotCursor = (slotCursor + 1) % slots.length;

    const instructor = instructors[instructorCursor % instructors.length];
    instructorCursor = (instructorCursor + 1) % instructors.length;

    const room = rooms[roomCursor % rooms.length];
    roomCursor = (roomCursor + 1) % rooms.length;

    out.push({
      schedule_id: nextScheduleId++,
      course_name: course.course_name,
      credit_hours: course.credit_hours,
      instructor_name: instructor.instructor_name,
      room_name: room.room_name,
      capacity: room.capacity,
      day: slot.day,
      start_time: slot.start_time,
      end_time: slot.end_time,
      course_id: course.course_id,
      instructor_id: instructor.instructor_id,
      room_id: room.room_id,
      time_id: slot.time_id,
    });
  }
}

const outPath = path.join(dataDir, "schedule.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(
  `Wrote ${out.length} sections covering ${ordered.length} courses to ${outPath}`
);

// Sanity stats
const perSlot = new Map<number, number>();
for (const s of out) perSlot.set(s.time_id, (perSlot.get(s.time_id) ?? 0) + 1);
console.log("\nSections per slot:");
for (const slot of slots) {
  const day = slot.day.padEnd(10);
  const time = `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`;
  console.log(`  ${day} ${time}  ${perSlot.get(slot.time_id) ?? 0}`);
}
