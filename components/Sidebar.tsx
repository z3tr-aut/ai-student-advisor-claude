"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat Home", icon: "chat_bubble" },
  { href: "/advisor", label: "Advisor", icon: "school" },
  { href: "/courses", label: "My Courses", icon: "menu_book" },
  { href: "/profile", label: "Profile", icon: "person" },
  { href: "/recommendations", label: "Recommendations", icon: "auto_awesome" },
  { href: "/history", label: "History", icon: "history" },
];

export default function Sidebar({
  fullName,
  subtitle,
  avatarUrl,
}: {
  fullName: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden md:flex flex-col bg-surface-container-low w-64 fixed left-0 top-[72px] bottom-0 shadow-[40px_0_40px_-20px_rgba(0,0,0,0.3)] z-40">
      {/* Scrollable top section */}
      <div className="flex flex-col gap-4 flex-1 overflow-y-auto py-8">
        {/* User card */}
        <div className="px-6 mb-6">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-cta-gradient flex items-center justify-center text-white font-headline font-bold text-title-sm">
                {initials || "?"}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="font-headline text-title-lg text-on-surface font-bold truncate">
                {fullName}
              </p>
              {subtitle && (
                <p className="font-body text-label-md text-on-surface-variant truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="flex flex-col gap-1 pr-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="mt-8 px-6">
          <Link
            href="/chat?new=1"
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New Conversation
          </Link>
        </div>
      </div>

      {/* Sign Out — always pinned to bottom */}
      <div className="px-6 py-4 border-t border-outline-variant">
        <button
          onClick={handleLogout}
          className="text-on-surface-variant hover:text-on-surface flex items-center gap-3 py-2 transition-all font-body text-body-sm font-semibold text-left w-full"
        >
          <span className="material-symbols-outlined">logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
