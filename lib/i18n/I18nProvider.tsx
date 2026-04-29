"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { translate } from "./dict";
import { LANG_COOKIE, type Lang } from "./types";

type I18nValue = {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => Promise<void>;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  initialLang,
  authed,
  children,
}: {
  initialLang: Lang;
  authed: boolean;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const router = useRouter();

  const setLang = useCallback(
    async (next: Lang) => {
      setLangState(next);
      // Always persist as a cookie so unauthed visits remember.
      // 1 year sticky.
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // Persist to profile if authed (best-effort).
      if (authed) {
        try {
          await fetch("/api/profile/lang", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lang: next }),
          });
        } catch {
          // Cookie still applied — server will pick it up on refresh.
        }
      }
      router.refresh();
    },
    [authed, router]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
