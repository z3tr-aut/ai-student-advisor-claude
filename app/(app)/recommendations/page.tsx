import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdvisorCard from "@/components/AdvisorCard";

const KIND_META: Record<
  string,
  { icon: string; label: string }
> = {
  major: { icon: "school", label: "Major" },
  career: { icon: "work", label: "Career" },
  university: { icon: "apartment", label: "University" },
};

export default async function RecommendationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: recs } = await supabase
    .from("recommendations")
    .select("id, kind, title, summary, created_at")
    .eq("user_id", user!.id)
    .eq("is_saved", true)
    .order("created_at", { ascending: false });

  const recommendations = recs ?? [];
  const byKind = {
    major: recommendations.filter((r) => r.kind === "major"),
    career: recommendations.filter((r) => r.kind === "career"),
    university: recommendations.filter((r) => r.kind === "university"),
  };

  return (
    <div className="px-6 md:px-12 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
            CURATED SELECTION
          </p>
          <h1 className="font-headline text-display-sm text-on-surface mb-2">
            Your Recommendations
          </h1>
          <p className="font-body text-body-lg text-on-surface-variant">
            Everything the Advisor has suggested and you&apos;ve saved.
          </p>
        </div>
        <div className="glass-panel rounded-xl px-5 py-4 flex gap-6">
          <Stat label="TOTAL" value={recommendations.length.toString()} />
          <Stat
            label="CATEGORIES"
            value={
              [byKind.major, byKind.career, byKind.university].filter(
                (k) => k.length,
              ).length + "/3"
            }
          />
        </div>
      </div>

      {recommendations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-10">
          {(["major", "career", "university"] as const).map((kind) => {
            const items = byKind[kind];
            if (items.length === 0) return null;
            return (
              <section key={kind}>
                <h2 className="font-headline text-headline-md text-on-surface mb-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">
                    {KIND_META[kind].icon}
                  </span>
                  {KIND_META[kind].label}s
                  <span className="text-label-md font-normal text-on-surface-variant">
                    ({items.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((r) => (
                    <AdvisorCard
                      key={r.id}
                      eyebrow={new Date(r.created_at).toLocaleDateString()}
                      title={r.title}
                      body={r.summary ?? undefined}
                      icon={KIND_META[r.kind]?.icon ?? "auto_awesome"}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <p className="font-headline text-headline-md text-on-surface mt-1">
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="advisor-card text-center py-16">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-surface-variant items-center justify-center mb-6">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: "28px" }}
        >
          auto_awesome
        </span>
      </div>
      <h3 className="font-headline text-headline-sm text-on-surface mb-3">
        No saved recommendations yet
      </h3>
      <p className="font-body text-body-md text-on-surface-variant max-w-md mx-auto mb-6">
        Start a chat with the Advisor and save the suggestions that feel right.
        They&apos;ll live here for easy reference.
      </p>
      <Link href="/chat" className="btn-primary inline-flex items-center gap-2">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "20px" }}
        >
          chat_bubble
        </span>
        Start a conversation
      </Link>
    </div>
  );
}
