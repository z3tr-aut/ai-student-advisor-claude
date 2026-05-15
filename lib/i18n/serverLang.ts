/**
 * Server-only language resolver.
 *
 * Priority chain (first match wins):
 *   1. `lang` cookie set by an explicit Profile toggle (zero-latency client switch).
 *   2. `profiles.preferred_language` for an authed Supabase session.
 *   3. `Accept-Language` header preferring `ar*` over `en*`.
 *   4. English default.
 *
 * The result is the *active language* for the request — used by the root
 * layout to set `<html lang dir>` and passed into `<I18nProvider>`.
 */
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Lang } from "./types";
import { LANG_COOKIE } from "./types";

// Re-export so callers can import everything from one place if desired.
export type { Lang } from "./types";
export { LANG_COOKIE } from "./types";

export async function resolveServerLang(): Promise<Lang> {
  const cookieLang = cookies().get(LANG_COOKIE)?.value;
  if (cookieLang === "ar" || cookieLang === "en") return cookieLang;

  // Try Supabase profile if authed.
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", user.id)
        .maybeSingle();
      const profileLang = profile?.preferred_language;
      if (profileLang === "ar" || profileLang === "en") return profileLang;
    }
  } catch {
    // Supabase may not be reachable on early-edge paths — fall through.
  }

  // Accept-Language fallback. Match anything that prefers Arabic over English.
  const accept = headers().get("accept-language") ?? "";
  const arMatch = accept.match(/ar(?:-[A-Za-z]+)?\s*(?:;q=([0-9.]+))?/i);
  const enMatch = accept.match(/en(?:-[A-Za-z]+)?\s*(?:;q=([0-9.]+))?/i);
  if (arMatch) {
    const arWeight = Number(arMatch[1] ?? 1);
    const enWeight = enMatch ? Number(enMatch[1] ?? 1) : 0;
    if (arWeight >= enWeight) return "ar";
  }

  return "en";
}
