import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/lang
 * Persists the user's interface-language preference. Called from I18nProvider
 * whenever a logged-in user toggles the language pill. The cookie is set
 * client-side as well, so this is best-effort — if it fails (e.g. pre-migration
 * column missing), the cookie still takes effect for the session.
 */
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

  await supabase
    .from("profiles")
    .update({ preferred_language: lang })
    .eq("id", user.id);

  return NextResponse.json({ lang });
}
