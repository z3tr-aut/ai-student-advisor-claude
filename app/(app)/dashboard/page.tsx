import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardPromptBox from "./DashboardPromptBox";

const QUICK_STARTS = [
  {
    icon: "balance",
    eyebrow: "EXPLORE",
    title: "Find my major",
    description: "Match my interests to degree programs",
    prompt:
      "Based on my interests and skills, what majors should I consider? Explain why each is a good fit.",
  },
  {
    icon: "work",
    eyebrow: "CAREER",
    title: "Career paths",
    description: "Show me where my profile leads",
    prompt:
      "Given my profile, what are the most promising career paths for me in the next 5–10 years?",
  },
  {
    icon: "school",
    eyebrow: "UNIVERSITIES",
    title: "Right-fit schools",
    description: "Suggest universities for me",
    prompt:
      "Recommend universities that fit my preferred countries, interests, and academic strengths.",
  },
  {
    icon: "trending_up",
    eyebrow: "STRATEGY",
    title: "Study roadmap",
    description: "Plan the next semester",
    prompt:
      "Build me a semester roadmap to build the skills I need for my target career.",
  },
];

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
          Hi {firstName}, I&apos;m your Smart Advisor.
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Tell me about your goals and interests. I&apos;ll help you choose the
          right major, explore careers, and find universities that fit you.
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
              Personalise your recommendations
            </p>
            <p className="font-body text-body-sm text-on-surface-variant mt-1">
              Add your interests, skills, and preferred countries so I can give
              you sharper advice.
            </p>
          </div>
          <Link
            href="/profile"
            className="btn-secondary text-body-sm shrink-0"
          >
            Complete profile
          </Link>
        </div>
      )}

      {/* Quick-start grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {QUICK_STARTS.map((item) => (
          <Link
            key={item.title}
            href={`/chat?prompt=${encodeURIComponent(item.prompt)}`}
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
                  {item.eyebrow}
                </p>
                <h3 className="font-headline text-title-lg text-on-surface font-bold mb-1">
                  {item.title}
                </h3>
                <p className="font-body text-body-sm text-on-surface-variant">
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Prompt box — kicks off a new chat */}
      <DashboardPromptBox />

      <p className="text-center text-label-md uppercase tracking-widest text-on-surface-variant mt-12">
        Powered by AI Advisor Engine · {new Date().getFullYear()}
      </p>
    </div>
  );
}
