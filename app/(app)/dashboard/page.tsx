import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardPromptBox from "./DashboardPromptBox";
import { resolveServerLang } from "@/lib/i18n/serverLang";
import { translate } from "@/lib/i18n/dict";

const QUICK_STARTS = [
  { icon: "balance", prefix: "dashboard.qs.major" },
  { icon: "work", prefix: "dashboard.qs.career" },
  { icon: "school", prefix: "dashboard.qs.univ" },
  { icon: "trending_up", prefix: "dashboard.qs.strategy" },
] as const;

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, interests")
    .eq("id", user!.id)
    .single();

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const hasInterests = (profile?.interests?.length ?? 0) > 0;
  const lang = await resolveServerLang();
  const t = (k: string, params?: Record<string, string | number>) =>
    translate(lang, k, params);

  return (
    <div className="px-6 md:px-12 py-10 md:py-16 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-surface-variant items-center justify-center mb-6">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontSize: "32px" }}
          >
            auto_awesome
          </span>
        </div>
        <h1 className="font-headline text-display-md md:text-display-lg text-on-surface mb-4">
          {t("dashboard.greeting", { name: firstName })}
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          {t("dashboard.subhead")}
        </p>
      </div>

      {/* Profile nudge — appears only if interests empty */}
      {!hasInterests && (
        <div className="glass-panel rounded-xl p-5 mb-10 flex items-start md:items-center gap-4 flex-col md:flex-row">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-tertiary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-tertiary">
              lightbulb
            </span>
          </div>
          <div className="flex-1">
            <p className="font-headline text-title-md text-on-surface font-bold">
              {t("dashboard.nudge.title")}
            </p>
            <p className="font-body text-body-sm text-on-surface-variant mt-1">
              {t("dashboard.nudge.body")}
            </p>
          </div>
          <Link
            href="/profile"
            className="btn-secondary text-body-sm shrink-0"
          >
            {t("dashboard.nudge.cta")}
          </Link>
        </div>
      )}

      {/* Quick-start grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {QUICK_STARTS.map((item) => (
          <Link
            key={item.prefix}
            href={`/chat?prompt=${encodeURIComponent(t(`${item.prefix}.prompt`))}`}
            className="advisor-card group cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-11 h-11 rounded-xl bg-surface-variant flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-primary">
                  {item.icon}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-1">
                  {t(`${item.prefix}.eyebrow`)}
                </p>
                <h3 className="font-headline text-title-lg text-on-surface font-bold mb-1">
                  {t(`${item.prefix}.title`)}
                </h3>
                <p className="font-body text-body-sm text-on-surface-variant">
                  {t(`${item.prefix}.desc`)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Prompt box — kicks off a new chat */}
      <DashboardPromptBox />

      <p className="text-center text-label-md uppercase tracking-widest text-on-surface-variant mt-12">
        {t("dashboard.footer", { year: new Date().getFullYear() })}
      </p>
    </div>
  );
}
