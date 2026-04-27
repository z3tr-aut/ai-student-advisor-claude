/**
 * Create Supabase auth users for testing the rule engine.
 *
 * Each test student gets:
 *   - email:    student<std_id>@advisor-test.local
 *   - password: a freshly generated 16-char random string (printed once)
 *   - user_metadata.std_id: links them to a row in std_course.json fixtures
 *   - email_confirm: true (no inbox round-trip)
 *
 * Idempotent — re-running the script regenerates passwords for the same emails.
 *
 * Run:
 *   npm run seed:students
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const STUDENT_IDS = [1001, 1002, 1003] as const;

function makePassword(): string {
  // 16 url-safe characters, plenty of entropy for test logins.
  return randomBytes(12).toString("base64url");
}

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

  const results: Array<{ stdId: number; email: string; password: string; status: string }> = [];

  for (const stdId of STUDENT_IDS) {
    const email = `student${stdId}@advisor-test.local`;
    const password = makePassword();

    // Try to find an existing user with this email.
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (list.error) throw list.error;
    const existing = list.data.users.find((u) => u.email === email);

    if (existing) {
      const upd = await admin.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { ...(existing.user_metadata ?? {}), std_id: stdId },
        email_confirm: true,
      });
      if (upd.error) throw upd.error;
      results.push({ stdId, email, password, status: "updated" });
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { std_id: stdId, full_name: `Test Student ${stdId}` },
      });
      if (created.error) throw created.error;
      results.push({ stdId, email, password, status: "created" });
    }
  }

  console.log("\nTest student logins (save these — passwords are not stored):\n");
  console.log("  std_id  | email                                    | password");
  console.log("  --------+------------------------------------------+--------------------");
  for (const r of results) {
    console.log(
      `  ${String(r.stdId).padEnd(7)} | ${r.email.padEnd(40)} | ${r.password}   (${r.status})`
    );
  }
  console.log("\nLog in at http://localhost:3000/login\n");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
