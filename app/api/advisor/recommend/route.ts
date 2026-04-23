import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recommendForUser } from "@/lib/advisor/select";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { targetCredits?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const target = Math.max(1, Math.min(30, Number(body.targetCredits ?? 15) || 15));

  const outcome = await recommendForUser(supabase, user.id, target);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
