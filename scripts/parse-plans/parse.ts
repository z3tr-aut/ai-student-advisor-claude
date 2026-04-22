/**
 * Parses each IT Faculty PDF plan into a reviewable JSON file.
 *
 * PDF column order (after pdf-parse's getTable):
 *   [ empty, prereq_cell, weekly_hours_cell, credit_hours, course_name, course_code ]
 *
 * prereq_cell examples (Arabic RTL):
 *   ""                            no prereq
 *   "((2110122 )ﺱ)"               strict prereq: must pass 2110122 before
 *   "((2312311 )ﻡ)"               concurrent prereq
 *   "((2110138 )ﺱ) ((2110122 )ﺱ)" two strict prereqs
 *
 * Type comes from the page's text section headers:
 *   ﻣﺘﻄﻠﺒﺎﺕ ﺟﺎﻣﻌﻴﺔ  → 'university'
 *   ﻣﺘﻄﻠﺒﺎﺕ ﺍﻟﻜﻠﻴﺔ   → 'faculty'
 *   ﺍﻟﺘﺨﺼﺺ / ﻣﺘﻄﻠﺒﺎﺕ ﺍﻟﺘﺨﺼﺺ + ﺇﺟﺒﺎﺭﻱ → 'required'
 *   ﺍﻟﺘﺨﺼﺺ + ﺇﺧﺘﻴﺎﺭﻱ → 'elective'
 * We attach `type` by walking the text in reading order and bucketing.
 */
import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

type CourseType = "required" | "elective" | "university" | "faculty";
type Prereq = { code: string; kind: "strict" | "concurrent" };

export type ParsedCourse = {
  course_code: string;
  course_name: string;
  credit_hours: number;
  prereqs: Prereq[];
  type: CourseType;
};

export type ParsedPlan = {
  source_file: string;
  plan_id: string;       // derived from filename; user can edit
  major_id: string;      // derived from filename; user can edit
  major_na: string;      // best-effort from PDF header
  total_credits: number | null;
  courses: ParsedCourse[];
  warnings: string[];
};

// Section-header markers in the PDF's normalized text.
// We'll strip Arabic presentation-form shaping to plain base letters via NFKC.
const SECTION_MARKERS: { re: RegExp; type: CourseType }[] = [
  { re: /متطلبات\s*جامعية/, type: "university" },
  { re: /متطلبات\s*الكلية|متطلبات\s*كلية/, type: "faculty" },
  { re: /إجباري|اجباري/, type: "required" },
  { re: /إختياري|اختياري/, type: "elective" },
];

function norm(s: string): string {
  // Normalize Arabic presentation forms to base letters
  return s.normalize("NFKC");
}

function parsePrereqCell(raw: string): Prereq[] {
  if (!raw) return [];
  // Match any 7-digit code followed by (ﺱ) strict or (ﻡ) concurrent within parens.
  // After normalization the markers become "س" and "م".
  const n = norm(raw);
  const out: Prereq[] = [];
  const re = /(\d{6,7})\s*\)?\s*(س|م)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n)) !== null) {
    const code = m[1];
    const kind: Prereq["kind"] = m[2] === "م" ? "concurrent" : "strict";
    if (!out.find((p) => p.code === code)) {
      out.push({ code, kind });
    }
  }
  return out;
}

function filenameToPlanId(file: string): { plan_id: string; major_id: string; major_na: string } {
  const base = path.basename(file, ".pdf").trim();
  // Map Arabic filenames to ASCII plan ids (user can rename later)
  const asciiMap: Record<string, { plan: string; major: string; name: string }> = {
    "الامن السيبراني": { plan: "CYBER_V1", major: "CYBER", name: "Cybersecurity" },
    "برمجيات 1": { plan: "SE_V1", major: "SE", name: "Software Engineering" },
    "برمجيات 2": { plan: "SE_V2", major: "SE", name: "Software Engineering" },
    "برمجيات3": { plan: "SE_V3", major: "SE", name: "Software Engineering" },
    "برمجيات5": { plan: "SE_V5", major: "SE", name: "Software Engineering" },
    "برمجيات6": { plan: "SE_V6", major: "SE", name: "Software Engineering" },
    "ذكاء1": { plan: "AI_V1", major: "AI", name: "Artificial Intelligence" },
    "ذكاء2": { plan: "AI_V2", major: "AI", name: "Artificial Intelligence" },
    "ذكاء3": { plan: "AI_V3", major: "AI", name: "Artificial Intelligence" },
    "ذكاء4": { plan: "AI_V4", major: "AI", name: "Artificial Intelligence" },
  };
  const m = asciiMap[base];
  if (m) return { plan_id: m.plan, major_id: m.major, major_na: m.name };
  // fallback slug
  const slug = base.replace(/\s+/g, "_").toUpperCase();
  return { plan_id: slug, major_id: slug, major_na: base };
}

function extractTotalCredits(text: string): number | null {
  // look for: رئيسي 132  OR  ساعات الخطة ... 132
  const n = norm(text);
  const m = n.match(/(?:رئيسي|ساعات\s*الخطة[^\d]*)(\d{3})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Walk the full document text in reading order and build a map:
 *   course_code → type
 * by remembering the most recent section marker we saw before a code.
 */
function buildTypeMap(fullText: string): Map<string, CourseType> {
  const n = norm(fullText);
  // Greedy scan: walk lines / tokens, track current type, assign to next-seen code.
  const typeMap = new Map<string, CourseType>();
  let current: CourseType = "required";
  let currentCategory: CourseType | null = null;  // tracks "university" / "faculty" / "major"
  let currentGroup: "required" | "elective" | null = null;

  const lines = n.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Category sets base
    if (/متطلبات\s*جامعية/.test(line)) { currentCategory = "university"; current = "university"; continue; }
    if (/متطلبات\s*الكلية/.test(line)) { currentCategory = "faculty"; current = "faculty"; continue; }
    if (/التخصص|متطلبات\s*التخصص/.test(line)) { currentCategory = "required"; current = "required"; continue; }
    // Group (required/elective) overrides *within* a category for the major
    if (/إجباري|اجباري/.test(line)) {
      currentGroup = "required";
      if (currentCategory === "required") current = "required";
      continue;
    }
    if (/إختياري|اختياري/.test(line)) {
      currentGroup = "elective";
      if (currentCategory === "required") current = "elective";
      continue;
    }
    // Assign all 7-digit codes on this line to the current type
    const codes = line.match(/\b\d{6,7}\b/g);
    if (codes) {
      for (const c of codes) {
        if (!typeMap.has(c)) typeMap.set(c, current);
      }
    }
  }
  return typeMap;
}

async function parseOne(file: string): Promise<ParsedPlan> {
  const warnings: string[] = [];
  const buf = fs.readFileSync(file);
  const parser = new PDFParse({ data: new Uint8Array(buf) });

  const textResult = await parser.getText();
  const tableResult = await parser.getTable();
  await parser.destroy();

  const fullText = textResult.text ?? "";
  const typeMap = buildTypeMap(fullText);
  const ids = filenameToPlanId(file);
  const total = extractTotalCredits(fullText);

  const courses: ParsedCourse[] = [];
  const seen = new Set<string>();

  for (const page of tableResult.pages ?? []) {
    for (const tbl of page.tables ?? []) {
      for (const row of tbl) {
        // row: [empty, prereq, weekly, credits, name, code]
        if (!Array.isArray(row) || row.length < 6) continue;
        const [, prereqCell, , creditCell, nameCell, codeCell] = row;
        const code = (codeCell ?? "").trim();
        if (!/^\d{6,7}$/.test(code)) continue;
        if (seen.has(code)) continue;

        const credit = parseInt((creditCell ?? "").toString().split("\n")[0].trim(), 10);
        if (!Number.isFinite(credit) || credit <= 0 || credit > 6) {
          warnings.push(`Course ${code}: invalid credit hours "${creditCell}"`);
        }
        const name = norm((nameCell ?? "").toString().replace(/\n/g, " ").trim());
        const prereqs = parsePrereqCell((prereqCell ?? "").toString());
        const type = typeMap.get(code) ?? "required";

        courses.push({
          course_code: code,
          course_name: name,
          credit_hours: Number.isFinite(credit) ? credit : 3,
          prereqs,
          type,
        });
        seen.add(code);
      }
    }
  }

  if (courses.length === 0) {
    warnings.push("No courses extracted — layout may differ for this PDF.");
  }

  return {
    source_file: path.basename(file),
    plan_id: ids.plan_id,
    major_id: ids.major_id,
    major_na: ids.major_na,
    total_credits: total,
    courses,
    warnings,
  };
}

async function main() {
  const plansDir = "C:/Users/عبدالرحمن/Desktop/AI-student advisor/IT deb plans";
  const outDir = path.join(__dirname, "out");
  fs.mkdirSync(outDir, { recursive: true });

  const pdfs = fs.readdirSync(plansDir).filter((f) => f.endsWith(".pdf"));
  console.log(`Found ${pdfs.length} PDFs in ${plansDir}`);

  const results: ParsedPlan[] = [];
  for (const f of pdfs) {
    const full = path.join(plansDir, f);
    process.stdout.write(`  parsing ${f} ... `);
    try {
      const plan = await parseOne(full);
      const outFile = path.join(outDir, `${plan.plan_id}.json`);
      fs.writeFileSync(outFile, JSON.stringify(plan, null, 2), "utf8");
      console.log(`${plan.courses.length} courses → ${path.basename(outFile)}${plan.warnings.length ? ` (${plan.warnings.length} warnings)` : ""}`);
      results.push(plan);
    } catch (e) {
      console.log(`FAILED: ${(e as Error).message}`);
    }
  }

  // Summary
  const total = results.reduce((a, p) => a + p.courses.length, 0);
  const totalWarn = results.reduce((a, p) => a + p.warnings.length, 0);
  console.log(`\nDONE. ${results.length} plans, ${total} total courses, ${totalWarn} warnings.`);
  console.log(`Review individual JSON files in: ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
