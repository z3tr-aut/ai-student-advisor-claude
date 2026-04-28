/**
 * Schedule acceptance API.
 *
 *   POST   /api/schedule/accept   { schedule_ids: string[], semester_id?: string }
 *     Replaces the student's accepted schedule for the active semester
 *     with the given list of schedule_ids (uuids from public.schedule).
 *   DELETE /api/schedule/accept
 *     Discards the student's accepted schedule for the active semester.
 *
 * Fixture-mode users (those with `std_id` in user_metadata but no real `std`
 * row) get a 200 with `{ fixture: true }` — the client persists locally.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function resolveStudent(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data } = await supabase
    .from("std")
    .select("std_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data?.std_id ?? null;
}

async function resolveActiveSemesterId(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const { data } = await supabase
    .from("semester")
    .select("semester_id")
    .eq("status", "current")
    .maybeSingle();
  return data?.semester_id ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const scheduleIds: unknown = body?.schedule_ids;
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    return NextResponse.json(
      { error: "schedule_ids must be a non-empty array" },
      { status: 400 }
    );
  }
  const ids = scheduleIds.filter((x): x is string => typeof x === "string");

  const meta = (user.user_metadata ?? {}) as { std_id?: number | string };
  const isFixtureUser = meta.std_id !== undefined;
  if (isFixtureUser) {
    return NextResponse.json({ fixture: true, accepted: ids });
  }

  const stdId = await resolveStudent(supabase, user.id);
  if (!stdId) {
    return NextResponse.json({ error: "Student record not found" }, { status: 400 });
  }

  const semesterId =
    typeof body?.semester_id === "string" && body.semester_id
      ? body.semester_id
      : await resolveActiveSemesterId(supabase);
  if (!semesterId) {
    return NextResponse.json(
      { error: "No active semester" },
      { status: 400 }
    );
  }

  const { error: delErr } = await supabase
    .from("student_schedule")
    .delete()
    .eq("std_id", stdId)
    .eq("semester_id", semesterId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const rows = ids.map((schedule_id) => ({
    std_id: stdId,
    semester_id: semesterId,
    schedule_id,
  }));
  const { error: insErr } = await supabase.from("student_schedule").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ accepted: ids, semester_id: semesterId });
}

export async function DELETE(_req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meta = (user.user_metadata ?? {}) as { std_id?: number | string };
  const isFixtureUser = meta.std_id !== undefined;
  if (isFixtureUser) {
    return NextResponse.json({ fixture: true, discarded: true });
  }

  const stdId = await resolveStudent(supabase, user.id);
  if (!stdId) {
    return NextResponse.json({ error: "Student record not found" }, { status: 400 });
  }

  const semesterId = await resolveActiveSemesterId(supabase);
  if (!semesterId) {
    return NextResponse.json({ error: "No active semester" }, { status: 400 });
  }

  const { error } = await supabase
    .from("student_schedule")
    .delete()
    .eq("std_id", stdId)
    .eq("semester_id", semesterId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discarded: true, semester_id: semesterId });
}
