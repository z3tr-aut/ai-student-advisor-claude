"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function TopNav({
  userEmail,
}: {
  userEmail?: string | null;
}) {
  const { t } = useI18n();
  return (
    <header className="bg-surface flex justify-between items-center w-full px-6 md:px-8 py-4 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link
          href="/dashboard"
          className="text-xl font-headline font-black text-on-surface tracking-tight"
        >
          {t("brand.name")}
        </Link>
        <nav className="hidden md:flex gap-6">
          <NavItem href="/dashboard" label={t("topnav.home")} />
          <NavItem href="/recommendations" label={t("topnav.recommendations")} />
          <NavItem href="/history" label={t("topnav.insights")} />
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/profile"
          className="scale-95 active:opacity-80 transition-all text-on-surface-variant hover:text-on-surface"
          aria-label={userEmail ?? t("topnav.account")}
          title={userEmail ?? t("topnav.account")}
        >
          <span className="material-symbols-outlined">account_circle</span>
        </Link>
      </div>
    </header>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-on-surface-variant font-body text-body-md font-medium hover:text-on-surface transition-colors duration-200"
    >
      {label}
    </Link>
  );
}
