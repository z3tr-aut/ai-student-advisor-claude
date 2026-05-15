"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      console.error("[signup] Supabase auth error:", error.message);
      setError(t("auth.signupError"));
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setInfo(t("auth.confirmEmail"));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 end-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 start-1/4 w-[400px] h-[400px] rounded-full bg-tertiary/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-cta-gradient items-center justify-center mb-6">
            <span className="material-symbols-outlined text-white" style={{ fontSize: "28px" }}>
              school
            </span>
          </div>
          <h1 className="font-headline text-display-sm text-on-surface mb-2">
            {t("auth.beginJourney")}
          </h1>
          <p className="font-body text-body-md text-on-surface-variant">
            {t("auth.tagline")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel rounded-xl p-8 flex flex-col gap-5"
        >
          <div>
            <label className="block font-body text-label-lg text-on-surface-variant mb-2">
              {t("auth.fullName")}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full bg-surface-container-high text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all"
              placeholder={t("auth.fullNamePlaceholder")}
            />
          </div>
          <div>
            <label className="block font-body text-label-lg text-on-surface-variant mb-2">
              {t("auth.email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full bg-surface-container-high text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all"
              placeholder={t("auth.emailPlaceholderSignup")}
            />
          </div>
          <div>
            <label className="block font-body text-label-lg text-on-surface-variant mb-2">
              {t("auth.password")}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-surface-container-high text-on-surface font-body text-body-md px-4 py-3 rounded-lg outline-none focus:shadow-glow transition-all"
              placeholder={t("auth.passwordPlaceholderSignup")}
            />
          </div>

          {error && (
            <div className="bg-error-container/40 text-on-error-container px-4 py-3 rounded-lg text-body-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-tertiary/10 text-tertiary px-4 py-3 rounded-lg text-body-sm">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? t("auth.creatingAccount") : t("auth.createAccountButton")}
          </button>

          <p className="text-center font-body text-body-sm text-on-surface-variant mt-2">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
