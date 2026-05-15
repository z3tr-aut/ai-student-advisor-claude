"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SuggestionChip from "@/components/SuggestionChip";
import { useI18n } from "@/lib/i18n/I18nProvider";

const SUGGESTION_KEYS = [
  "dashboard.prompt.suggestion1",
  "dashboard.prompt.suggestion2",
  "dashboard.prompt.suggestion3",
] as const;

export default function DashboardPromptBox() {
  const router = useRouter();
  const { t } = useI18n();
  const [value, setValue] = useState("");

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    router.push(`/chat?prompt=${encodeURIComponent(q)}`);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="chat-input-shell flex items-center gap-3 ps-5 pe-2 py-2"
      >
        <span className="material-symbols-outlined text-on-surface-variant">
          psychology
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("dashboard.prompt.placeholder")}
          className="flex-1 bg-transparent outline-none text-on-surface font-body text-body-md placeholder:text-on-surface-variant/70 py-2"
        />
        <button
          type="submit"
          aria-label={t("common.send")}
          className="w-10 h-10 rounded-full bg-cta-gradient flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            arrow_forward
          </span>
        </button>
      </form>

      <div className="flex items-center gap-2 flex-wrap justify-center mt-5">
        <span className="text-label-md uppercase tracking-widest text-on-surface-variant me-1">
          {t("dashboard.prompt.try")}
        </span>
        {SUGGESTION_KEYS.map((k) => {
          const label = t(k);
          return (
            <SuggestionChip
              key={k}
              label={`"${label}"`}
              onClick={() => submit(label)}
            />
          );
        })}
      </div>
    </div>
  );
}
