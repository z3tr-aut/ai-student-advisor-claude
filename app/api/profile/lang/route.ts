import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lang = body?.lang;
  if (lang !== "en" && lang !== "ar") {
    return NextResponse.json({ error: "lang must be 'en' or 'ar'" }, { status: 400 });
  }

  // Best-effort write — fixture users won't have a profiles row in some
  // setups, so don't 500 if the update doesn't land.
  await supabase.from("profiles").update({ lang }).eq("id", user.id);

  return NextResponse.json({ lang });
}
