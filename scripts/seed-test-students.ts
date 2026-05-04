/**
 * Create Supabase auth users for testing the rule engine, AND wire each one up
 * to the academic tables so they can log in straight onto the advisor without
 * touching the onboarding form.
 *
 * Each test student gets:
 *   - email:    student<std_id>@advisor-test.local
 *   - password: a freshly generated 16-char random string (printed once)
 *   - user_metadata.std_id: links them to fixture data (used by the chat tool)
 *   - email_confirm: true (no inbox round-trip)
 *   - row in public.std with major_id + plan_id + auth_user_id
 *   - profiles.std_id set, so the advisor onboarding gate is satisfied
 *   - public.std_course rows: 6 "passed" + 3 "enrolled" courses pulled from
 *     their plan catalog (different slice per student so they don't all look
 *     identical)
 *
 * Idempotent — re-running regenerates passwords and replaces std_course rows.
 *
 * Requires the catalog seed (supabase/seed/plans.sql) to have been applied
 * already; otherwise there will be no plan/course rows to link to.
 *
 * Run:
 *   npm run seed:students
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

type TestStudent = {
  stdId: number;
  name: string;
  majorId: string;
  planId: string;
};

const TEST_STUDENTS: readonly TestStudent[] = [
  { stdId: 1001, name: "Test Student 1001", majorId: "AI", planId: "AI_V1" },
  { stdId: 1002, name: "Test Student 1002", majorId: "AI", planId: "AI_V1" },
  { stdId: 1003, name: "Test Student 1003", majorId: "AI", planId: "AI_V1" },
] as const;

const PASSED_COUNT = 6;
const ENROLLED_COUNT = 3;

function makePassword(): string {
  // 16 url-safe characters, plenty of entropy for test logins.
  return randomBytes(12).toString("base64url");
}

async function ensureCurrentSemester(admin: SupabaseClient): Promise<string> {
  const { data: existing, error: selErr } = await admin
    .from("semester")
    .select("semester_id")
    .eq("status", "current")
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing?.semester_id) return existing.semester_id;

  const semId = "S2026A";
  const { error: insErr } = await admin.from("semester").upsert(
    {
      semester_id: semId,
      name: "Spring 2026",
      s_date: "2026-02-01",
      e_date: "2026-06-15",
      status: "current",
    },
    { onConflict: "semester_id" }
  );
  if (insErr) throw insErr;
  return semId;
}

type CatalogCourse = {
  course_id: string;
  course_na: string;
  semester_order: number | null;
  type: string;
};

async function loadPlanCourses(
  admin: SupabaseClient,
  planId: string
): Promise<CatalogCourse[]> {
  const { data, error } = await admin
    .from("course")
    .select("course_id, course_na, semester_order, type")
    .eq("plan_id", planId)
    .order("semester_order", { ascending: true, nullsFirst: false })
    .order("course_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CatalogCourse[];
}

function pickCourseSlice(
  pool: CatalogCourse[],
  offset: number,
  count: number
): CatalogCourse[] {
  if (pool.length === 0) return [];
  const out: CatalogCourse[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[(offset + i) % pool.length]);
  }
  return out;
}

type AcademicSeedResult = {
  passed: number;
  enrolled: number;
};

async function seedAcademic(
  admin: SupabaseClient,
  authUserId: string,
  student: TestStudent,
  currentSemesterId: string
): Promise<AcademicSeedResult> {
  const planCourses = await loadPlanCourses(admin, student.planId);
  if (planCourses.length === 0) {
    console.warn(
      `  ! no courses found for plan ${student.planId}; did you run supabase/seed/plans.sql?`
    );
    return { passed: 0, enrolled: 0 };
  }

  // Prefer "core" courses (faculty + required) for richer test data; fall back
  // to the full plan if there aren't enough core ones.
  const core = planCourses.filter(
    (c) => c.type === "required" || c.type === "faculty"
  );
  const pool = core.length >= PASSED_COUNT + ENROLLED_COUNT ? core : planCourses;

  // Stagger each student so they have overlapping but not identical histories.
  const offset = ((student.stdId - 1001) * 3) % Math.max(1, pool.length);
  const passedCourses = pickCourseSlice(pool, offset, PASSED_COUNT);
  const passedIds = new Set(passedCourses.map((c) => c.course_id));
  // For "enrolled" we want courses NOT already in passed, walking forward.
  const enrolledCourses: CatalogCourse[] = [];
  for (
    let i = PASSED_COUNT;
    enrolledCourses.length < ENROLLED_COUNT && i < PASSED_COUNT + pool.length;
    i++
  ) {
    const c = pool[(offset + i) % pool.length];
    if (!passedIds.has(c.course_id)) enrolledCourses.push(c);
  }

  // Upsert the student row, linking auth user → std_id.
  const { error: stdErr } = await admin.from("std").upsert(
    {
      std_id: String(student.stdId),
      std_na: student.name,
      major_id: student.majorId,
      plan_id: student.planId,
      auth_user_id: authUserId,
    },
    { onConflict: "std_id" }
  );
  if (stdErr) throw stdErr;

  // Profiles row is auto-created by the on_auth_user_created trigger; just
  // attach std_id so the advisor's onboarding gate passes.
  const { error: profErr } = await admin
    .from("profiles")
    .update({ std_id: String(student.stdId) })
    .eq("id", authUserId);
  if (profErr) throw profErr;

  // Wipe + reinsert this student's history so re-runs stay deterministic.
  const { error: delErr } = await admin
    .from("std_course")
    .delete()
    .eq("std_id", String(student.stdId));
  if (delErr) throw delErr;

  const passedRows = passedCourses.map((c) => ({
    std_id: String(student.stdId),
    course_id: c.course_id,
    status: "passed" as const,
    grade: 3.5,
  }));
  const enrolledRows = enrolledCourses.map((c) => ({
    std_id: String(student.stdId),
    course_id: c.course_id,
    status: "enrolled" as const,
    semester_id: currentSemesterId,
  }));

  const allRows = [...passedRows, ...enrolledRows];
  if (allRows.length > 0) {
    const { error: insErr } = await admin.from("std_course").insert(allRows);
    if (insErr) throw insErr;
  }

  return { passed: passedRows.length, enrolled: enrolledRows.length };
}

type SeedResult = {
  stdId: number;
  email: string;
  password: string;
  status: string;
  passed: number;
  enrolled: number;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const currentSemesterId = await ensureCurrentSemester(admin);
  const results: SeedResult[] = [];

  for (const student of TEST_STUDENTS) {
    const email = `student${student.stdId}@advisor-test.local`;
    const password = makePassword();

    // Try to find an existing user with this email.
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (list.error) throw list.error;
    const existing = list.data.users.find((u) => u.email === email);

    let authUserId: string;
    let status: string;

    if (existing) {
      const upd = await admin.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          std_id: student.stdId,
          full_name: student.name,
        },
        email_confirm: true,
      });
      if (upd.error) throw upd.error;
      authUserId = existing.id;
      status = "updated";
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { std_id: student.stdId, full_name: student.name },
      });
      if (created.error) throw created.error;
      authUserId = created.data.user!.id;
      status = "created";
    }

    const academic = await seedAcademic(
      admin,
      authUserId,
      student,
      currentSemesterId
    );

    results.push({
      stdId: student.stdId,
      email,
      password,
      status,
      passed: academic.passed,
      enrolled: academic.enrolled,
    });
  }

  console.log("\nTest student logins (save these — passwords are not stored):\n");
  console.log(
    "  std_id  | email                                    | password"
  );
  console.log(
    "  --------+------------------------------------------+--------------------"
  );
  for (const r of results) {
    console.log(
      `  ${String(r.stdId).padEnd(7)} | ${r.email.padEnd(40)} | ${r.password}   (${r.status})`
    );
  }

  console.log("\nAcademic data seeded:\n");
  console.log("  std_id  | major | plan    | passed | enrolled");
  console.log("  --------+-------+---------+--------+---------");
  for (const r of results) {
    const s = TEST_STUDENTS.find((t) => t.stdId === r.stdId)!;
    console.log(
      `  ${String(r.stdId).padEnd(7)} | ${s.majorId.padEnd(5)} | ${s.planId.padEnd(7)} | ${String(r.passed).padEnd(6)} | ${r.enrolled}`
    );
  }

  console.log(`\nCurrent semester: ${currentSemesterId}`);
  console.log("Log in at http://localhost:3000/login\n");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
