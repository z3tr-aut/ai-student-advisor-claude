"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SuggestionChip from "@/components/SuggestionChip";

const SUGGESTIONS = [
  "I like coding and maths",
  "Best careers for someone who loves biology",
  "Compare CS vs Data Science",
];

export default function DashboardPromptBox() {
  const router = useRouter();
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
        className="chat-input-shell flex items-center gap-3 pl-5 pr-2 py-2"
      >
        <span className="material-symbols-outlined text-on-surface-variant">
          psychology
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. I want a career in AI but I'm also into design…"
          className="flex-1 bg-transparent outline-none text-on-surface font-body text-body-md placeholder:text-on-surface-variant/70 py-2"
        />
        <button
          type="submit"
          aria-label="Send"
          className="w-10 h-10 rounded-full bg-cta-gradient flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            arrow_forward
          </span>
        </button>
      </form>

      <div className="flex items-center gap-2 flex-wrap justify-center mt-5">
        <span className="text-label-md uppercase tracking-widest text-on-surface-variant mr-1">
          Try:
        </span>
        {SUGGESTIONS.map((s) => (
          <SuggestionChip key={s} label={`"${s}"`} onClick={() => submit(s)} />
        ))}
      </div>
    </div>
  );
}
