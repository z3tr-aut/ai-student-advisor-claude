"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-8 flex flex-col gap-5">
      <div>
        <label className="block font-body text-label-lg text-on-surface-variant mb-2">{t("auth.email")}</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" placeholder="you@gmail.com"
          className="w-full bg-surface-container-high text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all" />
      </div>
      <div>
        <label className="block font-body text-label-lg text-on-surface-variant mb-2">{t("auth.password")}</label>
        <div className="relative">
          <input type={showPassword ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" placeholder="••••••••"
            className="w-full bg-surface-container-high text-on-surface font-body text-body-md px-4 py-3 pr-12 rounded-lg outline-none focus:shadow-glow transition-all" />
          <button type="button" onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </div>
      {error && <div className="bg-error-container/40 text-on-error-container px-4 py-3 rounded-lg text-body-sm">{error}</div>}
      <button type="submit" disabled={loading} className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
        {loading ? t("common.loading") : t("auth.signIn")}
      </button>
      <p className="text-center font-body text-body-sm text-on-surface-variant mt-2">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="text-primary font-semibold hover:underline">{t("auth.signUpHere")}</Link>
      </p>
    </form>
  );
}

function LoginPageInner() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-cta-gradient items-center justify-center mb-4">
            <span className="material-symbols-outlined text-white" style={{ fontSize: "28px" }}>auto_awesome</span>
          </div>
          <p className="font-headline text-title-md font-black text-on-surface mb-2">{t("brand.name")}</p>
          <h1 className="font-headline text-display-sm text-on-surface mb-2">{t("auth.welcomeBack")}</h1>
          <p className="font-body text-body-md text-on-surface-variant">{t("auth.signInToContinue")}</p>
        </div>
        <Suspense fallback={<div className="glass-panel rounded-xl p-8 text-center text-on-surface-variant">{t("common.loading")}</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageInner />;
}
