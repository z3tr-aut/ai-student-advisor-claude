"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SuggestionChip from "@/components/SuggestionChip";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  splitSchedulePayload,
  type MessageMetadata,
  type SchedulePick,
} from "@/lib/advisor/chat-payload";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { localizedDay } from "@/lib/i18n/dict";

type Msg = {
  role: "user" | "assistant";
  content: string;
  metadata?: MessageMetadata | null;
};

type Profile = {
  full_name?: string | null;
  interests?: string[] | null;
  skills?: string[] | null;
  preferred_countries?: string[] | null;
  grades?: Record<string, unknown> | null;
  education_level?: string | null;
  bio?: string | null;
};

const QUICK_REPLY_KEYS = [
  "chat.quickReply.tellMore",
  "chat.quickReply.majors",
  "chat.quickReply.universities",
  "chat.quickReply.skills",
];

const FIXTURE_SCHEDULE_KEY = "studentSchedule:current";

type AcceptState = {
  open: boolean;
  picks: SchedulePick[];
  totalCredits: number;
  busy: boolean;
};

export default function ChatClient({
  initialMessages,
  initialSessionId,
  initialTitle,
  seedPrompt,
  profile,
}: {
  initialMessages: Msg[];
  initialSessionId: string | null;
  initialTitle: string | null;
  seedPrompt: string | null;
  profile: Profile | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accept, setAccept] = useState<AcceptState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seedFired = useRef(false);

  const quickReplies = useMemo(() => QUICK_REPLY_KEYS.map((k) => t(k)), [t]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (seedFired.current) return;
    if (seedPrompt && messages.length === 0) {
      seedFired.current = true;
      void send(seedPrompt);
    }
  }, [seedPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInput("");
    const newUserMsg: Msg = { role: "user", content: trimmed };
    const updated = [...messages, newUserMsg];
    setMessages([...updated, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated.map(({ role, content }) => ({ role, content })),
          sessionId,
          profile,
          lang,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const newSessionId = res.headers.get("x-session-id");
      if (newSessionId && !sessionId) {
        setSessionId(newSessionId);
        const url = new URL(window.location.href);
        url.searchParams.set("session", newSessionId);
        url.searchParams.delete("prompt");
        url.searchParams.delete("new");
        window.history.replaceState({}, "", url.toString());
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let raw = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const split = splitSchedulePayload(raw);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: split.text,
            metadata: split.metadata,
          };
          return next;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      router.refresh();
    }
  }

  function openAccept(picks: SchedulePick[], totalCredits: number) {
    setAccept({ open: true, picks, totalCredits, busy: false });
  }

  async function confirmAccept() {
    if (!accept) return;
    setAccept({ ...accept, busy: true });
    try {
      const res = await fetch("/api/schedule/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_ids: accept.picks.map((p) => p.schedule_id),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save");

      if (body.fixture && typeof window !== "undefined") {
        window.localStorage.setItem(
          FIXTURE_SCHEDULE_KEY,
          JSON.stringify({
            picks: accept.picks,
            totalCredits: accept.totalCredits,
            acceptedAt: new Date().toISOString(),
          })
        );
      }
      setAccept(null);
      setToast(t("chat.toast.saved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setAccept(accept ? { ...accept, busy: false } : null);
      setError(message);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
        {empty ? (
          <div className="max-w-3xl mx-auto text-center pt-10">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-surface-variant items-center justify-center mb-6">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: "28px" }}>
                auto_awesome
              </span>
            </div>
            <h2 className="font-headline text-headline-lg text-on-surface mb-3">
              {t("chat.empty.title")}
            </h2>
            <p className="font-body text-body-md text-on-surface-variant">
              {t("chat.empty.body")}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            {initialTitle && !searchParams.get("new") && (
              <p className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
                {initialTitle}
              </p>
            )}
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                msg={m}
                onAccept={(picks, total) => openAccept(picks, total)}
                t={t}
                lang={lang}
              />
            ))}
            {streaming && messages[messages.length - 1]?.content === "" && (
              <TypingIndicator />
            )}
          </div>
        )}
      </div>

      {!empty && !streaming && (
        <div className="px-4 md:px-8 pb-3">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2 justify-center">
            {quickReplies.map((q) => (
              <SuggestionChip key={q} label={q} onClick={() => send(q)} />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 md:px-8 pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="bg-error-container/40 text-on-error-container px-4 py-3 rounded-lg text-body-sm mb-3">
              {error}
            </div>
          )}
          {toast && (
            <div className="bg-green-100 text-green-800 px-4 py-3 rounded-lg text-body-sm mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                check_circle
              </span>
              {toast}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="chat-input-shell flex items-center gap-3 pl-5 pr-2 py-2"
          >
            <span className="material-symbols-outlined text-on-surface-variant">
              chat_bubble
            </span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
              placeholder={t("chat.placeholder")}
              className="flex-1 bg-transparent outline-none text-on-surface font-body text-body-md placeholder:text-on-surface-variant/70 py-2 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="Send"
              className="w-10 h-10 rounded-full bg-cta-gradient flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                arrow_upward
              </span>
            </button>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={!!accept?.open}
        title={t("chat.acceptDialog.title")}
        body={
          accept ? (
            <div className="flex flex-col gap-2">
              <p>
                {t("chat.acceptDialog.summary", { count: accept.picks.length, credits: accept.totalCredits })}
              </p>
              <ul className="text-body-sm text-on-surface-variant pl-4 list-disc">
                {accept.picks.map((p) => (
                  <li key={p.schedule_id}>
                    {lang === "ar" && p.course_name_ar ? p.course_name_ar : p.course_name} — {localizedDay(p.day, lang as "en" | "ar")} {p.start_time}–{p.end_time}
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        }
        confirmLabel={t("chat.acceptDialog.confirm")}
        cancelLabel={t("common.notYet")}
        busy={accept?.busy ?? false}
        onConfirm={confirmAccept}
        onCancel={() => accept && !accept.busy && setAccept(null)}
      />
    </div>
  );
}

function MessageBubble({
  msg,
  onAccept,
  t,
  lang,
}: {
  msg: Msg;
  onAccept: (picks: SchedulePick[], totalCredits: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  lang: string;
}) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[85%] bg-surface-container-high rounded-2xl rounded-tr-md px-5 py-3">
          <p className="font-body text-body-md text-on-surface whitespace-pre-wrap">
            {msg.content}
          </p>
        </div>
      </div>
    );
  }

  const schedule =
    msg.metadata?.kind === "schedule" ? msg.metadata : null;

  return (
    <div className="msg-in flex gap-3 items-start">
      <div className="shrink-0 w-8 h-8 rounded-full bg-cta-gradient flex items-center justify-center">
        <span className="material-symbols-outlined text-white" style={{ fontSize: "16px" }}>
          auto_awesome
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          {t("chat.advisor")}
        </p>
        <div className="bg-surface-container-high rounded-2xl rounded-tl-md px-5 py-4">
          <p className="font-body text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
            {msg.content || " "}
          </p>
          {schedule && schedule.picks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-outline-variant flex items-center justify-between gap-3 flex-wrap">
              <p className="font-body text-body-sm text-on-surface-variant">
                {t("myschedule.summary", { count: schedule.picks.length, credits: schedule.total_credits })}
              </p>
              <button
                type="button"
                onClick={() => onAccept(schedule.picks, schedule.total_credits)}
                className="btn-primary text-body-sm py-2 px-4"
              >
                {t("chat.accept")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start msg-in">
      <div className="shrink-0 w-8 h-8 rounded-full bg-cta-gradient flex items-center justify-center">
        <span className="material-symbols-outlined text-white" style={{ fontSize: "16px" }}>
          auto_awesome
        </span>
      </div>
      <div className="bg-surface-container-high rounded-2xl rounded-tl-md px-5 py-4 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-on-surface-variant typing-dot" />
        <span className="w-2 h-2 rounded-full bg-on-surface-variant typing-dot" />
        <span className="w-2 h-2 rounded-full bg-on-surface-variant typing-dot" />
      </div>
    </div>
  );
}
