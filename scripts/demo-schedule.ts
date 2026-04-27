/**
 * CLI demo: run the rule engine against the fixture dataset for a chosen
 * student, target load, and time-window preferences. Prints the resulting
 * schedule, warnings, and unschedulable courses.
 *
 * Run:
 *   npx tsx scripts/demo-schedule.ts
 *   npx tsx scripts/demo-schedule.ts --student=1001 --credits=15 --earliest=08:00
 *   npx tsx scripts/demo-schedule.ts --student=1003 --credits=12 --excluded=Thursday
 */
import {
  buildStudentScenario,
  loadActiveSemester,
} from "../lib/advisor/fixtures";
import { recommendForSemester, lockedByPrereq } from "../lib/advisor/engine";
import { recommendSchedule } from "../lib/advisor/schedule";
import type { Day } from "../lib/advisor/fixtures/loader";

type Args = {
  student: number;
  credits: number;
  earliest?: string;
  latest?: string;
  excluded?: Day[];
};

function parseArgs(argv: string[]): Args {
  const out: Args = { student: 1001, credits: 15 };
  for (const a of argv.slice(2)) {
    const [k, v] = a.replace(/^--/, "").split("=");
    if (k === "student") out.student = Number(v);
    else if (k === "credits") out.credits = Number(v);
    else if (k === "earliest") out.earliest = v;
    else if (k === "latest") out.latest = v;
    else if (k === "excluded") out.excluded = v.split(",") as Day[];
  }
  return out;
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}

function main() {
  const args = parseArgs(process.argv);
  const scenario = buildStudentScenario(args.student);

  console.log("=".repeat(72));
  console.log(`Student: ${scenario.stdId}   Major id: ${scenario.majorId ?? "?"}`);
  console.log(`Active semester: ${loadActiveSemester().name}`);
  console.log(
    `Plan size: ${scenario.courses.length} courses, ` +
      `${scenario.history.passed.size} passed, ` +
      `${scenario.sections.length} sections offered`
  );
  console.log(`Target load: ${args.credits} credit hours`);
  if (args.earliest) console.log(`Earliest start: ${args.earliest}`);
  if (args.latest) console.log(`Latest end:     ${args.latest}`);
  if (args.excluded?.length) console.log(`Excluded days:  ${args.excluded.join(", ")}`);
  console.log("=".repeat(72));

  const courseRec = recommendForSemester({
    plan: scenario.courses,
    history: scenario.history,
    targetCredits: args.credits,
  });
  console.log(`\n[recommendForSemester]  picks: ${courseRec.picks.length}, total: ${courseRec.totalCredits}cr`);
  for (const c of courseRec.picks) {
    console.log(`  - ${c.id.padEnd(4)} ${c.name.padEnd(36)} ${c.credits}cr`);
  }
  if (courseRec.warnings.length) {
    console.log("  warnings:");
    courseRec.warnings.forEach((w) => console.log(`    ! ${w}`));
  }

  const locked = lockedByPrereq(scenario.courses, scenario.history);
  if (locked.length) {
    console.log(`\n  locked by prereq (${locked.length}):`);
    for (const l of locked.slice(0, 5)) {
      console.log(`    - ${l.course.name} — needs ${l.missing.join(", ")}`);
    }
    if (locked.length > 5) console.log(`    ...and ${locked.length - 5} more`);
  }

  const scheduleRec = recommendSchedule({
    plan: scenario.courses,
    sections: scenario.sections,
    history: scenario.history,
    targetCredits: args.credits,
    preferences: {
      earliestStart: args.earliest,
      latestEnd: args.latest,
      excludedDays: args.excluded,
    },
  });
  console.log(`\n[recommendSchedule]    picks: ${scheduleRec.picks.length}, total: ${scheduleRec.totalCredits}cr`);
  for (const p of scheduleRec.picks) {
    const t = `${fmtMinutes(p.section.startMinutes)}-${fmtMinutes(p.section.endMinutes)}`;
    const room = p.section.roomId ? ` room ${p.section.roomId}` : "";
    console.log(
      `  - ${p.course.name.padEnd(36)} ${p.course.credits}cr  ${p.section.day.padEnd(9)} ${t}${room}`
    );
  }
  if (scheduleRec.warnings.length) {
    console.log("  warnings:");
    scheduleRec.warnings.forEach((w) => console.log(`    ! ${w}`));
  }
  if (scheduleRec.unscheduled.length) {
    console.log(`  unscheduled (${scheduleRec.unscheduled.length}):`);
    for (const u of scheduleRec.unscheduled.slice(0, 8)) {
      console.log(`    - ${u.course.name.padEnd(36)} reason: ${u.reason}`);
    }
    if (scheduleRec.unscheduled.length > 8) {
      console.log(`    ...and ${scheduleRec.unscheduled.length - 8} more`);
    }
  }
  console.log();
}

main();
