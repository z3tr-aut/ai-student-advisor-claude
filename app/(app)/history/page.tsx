import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, title, updated_at, created_at")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  const list = sessions ?? [];

  return (
    <div className="px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <div className="mb-10">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          INSIGHTS
        </p>
        <h1 className="font-headline text-display-sm text-on-surface mb-2">
          Conversation History
        </h1>
        <p className="font-body text-body-lg text-on-surface-variant">
          Pick up where you left off — every chat with the Advisor is saved here.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="advisor-card text-center py-16">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-surface-variant items-center justify-center mb-6">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: "28px" }}
            >
              history
            </span>
          </div>
          <h3 className="font-headline text-headline-sm text-on-surface mb-3">
            No conversations yet
          </h3>
          <p className="font-body text-body-md text-on-surface-variant max-w-md mx-auto mb-6">
            Start a chat and your conversations will appear here — sorted by
            most recent.
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
      ) : (
        // 24px vertical rhythm, no divider lines — per DESIGN.md §5
        <div className="flex flex-col gap-6">
          {list.map((s) => (
            <Link
              key={s.id}
              href={`/chat?session=${s.id}`}
              className="advisor-card flex items-start justify-between gap-4 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                  {formatDate(s.updated_at)}
                </p>
                <h3 className="font-headline text-title-lg text-on-surface font-bold truncate group-hover:text-primary transition-colors">
                  {s.title || "Untitled conversation"}
                </h3>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                arrow_forward
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
