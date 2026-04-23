/**
 * Validate parsed plan JSON files and print a summary.
 *   - courses per type
 *   - total credit hours
 *   - courses with prereqs
 *   - unresolved prereqs (referenced code not present in THIS plan — these will
 *     silently be dropped when emitting SQL because of FK)
 */
import fs from "node:fs";
import path from "node:path";
import type { ParsedPlan } from "./parse";

const outDir = path.join(__dirname, "out");
const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".json") && !f.includes("tables"));

console.log(`Validating ${files.length} plan JSON files in ${outDir}\n`);

let grandTotal = 0;
let grandUnresolved = 0;

for (const f of files) {
  const plan: ParsedPlan = JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8"));
  const codes = new Set(plan.courses.map((c) => c.course_code));

  const typeCounts: Record<string, number> = {};
  let withPrereqs = 0;
  const unresolved: string[] = [];
  let creditSum = 0;

  for (const c of plan.courses) {
    typeCounts[c.type] = (typeCounts[c.type] ?? 0) + 1;
    creditSum += c.credit_hours;
    if (c.prereqs.length > 0) {
      withPrereqs++;
      for (const p of c.prereqs) {
        if (!codes.has(p.code)) unresolved.push(`${c.course_code} → ${p.code}`);
      }
    }
  }

  console.log(`▸ ${plan.plan_id} (${plan.source_file})`);
  console.log(`    major: ${plan.major_na}`);
  console.log(`    courses: ${plan.courses.length}   total credits: ${creditSum}`);
  console.log(`    types: ${JSON.stringify(typeCounts)}`);
  console.log(`    with prereqs: ${withPrereqs}`);
  if (unresolved.length) {
    console.log(`    unresolved prereq refs (${unresolved.length}):`);
    unresolved.slice(0, 10).forEach((u) => console.log(`      - ${u}`));
    if (unresolved.length > 10) console.log(`      ... ${unresolved.length - 10} more`);
  }
  console.log();

  grandTotal += plan.courses.length;
  grandUnresolved += unresolved.length;
}

console.log(`GRAND TOTALS:  courses=${grandTotal}   unresolved prereq refs=${grandUnresolved}`);
