import type { Metadata } from "next";
import "./globals.css";
import { resolveServerLang } from "@/lib/i18n/serverLang";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Smart Advisor",
  description:
    "Your sophisticated AI guide for majors, careers, and universities.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await resolveServerLang();
  const dir = lang === "ar" ? "rtl" : "ltr";

  // Tell the I18nProvider whether to also persist to profiles.lang on toggle.
  let authed = false;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    authed = !!user;
  } catch {
    authed = false;
  }

  return (
    <html lang={lang} dir={dir} className="dark">
      <head>
        {/* Design system typefaces — Manrope (headlines) + Inter (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-on-surface font-body min-h-screen">
        <I18nProvider initialLang={lang} authed={authed}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
