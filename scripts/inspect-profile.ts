import { buildStudentProfile } from "../lib/advisor/fixtures";

const stdId = Number(process.argv[2] ?? 1001);
const p = buildStudentProfile(stdId);
console.log(`Student: ${p.studentName ?? p.stdId}`);
console.log(`Major:   ${p.majorName ?? "?"} (id ${p.majorId ?? "?"})`);
console.log(`Year ~${p.approxYear}, ${p.creditsCompleted} credits completed`);
console.log(`Passed: ${p.passedCount}, enrolled: ${p.enrolledCount}, failed: ${p.failedCount}`);
console.log("Transcript:");
for (const t of p.transcript) {
  console.log(
    `  - ${t.courseId.padEnd(4)} ${t.courseName.padEnd(36)} ${t.credits}cr  ${t.status}${t.grade ? "  " + t.grade : ""}`
  );
}
