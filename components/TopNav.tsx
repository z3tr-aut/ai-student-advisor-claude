import Link from "next/link";

export default function TopNav({
  userEmail,
}: {
  userEmail?: string | null;
}) {
  return (
    <header className="bg-surface flex justify-between items-center w-full px-6 md:px-8 py-4 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link
          href="/dashboard"
          className="text-xl font-headline font-black text-on-surface tracking-tight"
        >
          Smart Advisor
        </Link>
        <nav className="hidden md:flex gap-6">
          <NavItem href="/dashboard" label="Home" />
          <NavItem href="/recommendations" label="Recommendations" />
          <NavItem href="/history" label="Insights" />
        </nav>
      </div>

      <div className="hidden lg:flex items-center bg-surface-container-low px-4 py-2 rounded-full gap-3">
        <span className="text-label-md font-semibold text-on-surface-variant uppercase tracking-wider">
          AI Status:
        </span>
        <span className="text-label-md bg-surface-container-high text-tertiary px-2 py-1 rounded-md font-medium">
          Ready
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/profile"
          className="scale-95 active:opacity-80 transition-all text-on-surface-variant hover:text-on-surface"
          aria-label="Profile settings"
        >
          <span className="material-symbols-outlined">settings</span>
        </Link>
        <Link
          href="/profile"
          className="scale-95 active:opacity-80 transition-all text-on-surface-variant hover:text-on-surface"
          aria-label={userEmail ?? "Account"}
          title={userEmail ?? "Account"}
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
