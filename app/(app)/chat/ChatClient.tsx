"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SuggestionChip from "@/components/SuggestionChip";

type Msg = { role: "user" | "assistant"; content: string };

type Profile = {
  full_name?: string | null;
  interests?: string[] | null;
  skills?: string[] | null;
  preferred_countries?: string[] | null;
  grades?: Record<string, unknown> | null;
  education_level?: string | null;
  bio?: string | null;
};

const QUICK_REPLIES = [
  "Tell me more",
  "What majors fit this?",
  "Which universities?",
  "Skills I should build",
];

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
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seedFired = useRef(false);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Fire the seed prompt from ?prompt= exactly once
  useEffect(() => {
    if (seedFired.current) return;
    if (seedPrompt && messages.length === 0) {
      seedFired.current = true;
      void send(seedPrompt);
    }
  }, [seedPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

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
          messages: updated,
          sessionId,
          profile,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      // Extract session id from response header (new sessions)
      const newSessionId = res.headers.get("x-session-id");
      if (newSessionId && !sessionId) {
        setSessionId(newSessionId);
        // Update the URL so refreshes keep the conversation
        const url = new URL(window.location.href);
        url.searchParams.set("session", newSessionId);
        url.searchParams.delete("prompt");
        url.searchParams.delete("new");
        window.history.replaceState({}, "", url.toString());
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return next;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant bubble
    } finally {
      setStreaming(false);
      // Refresh server data so sidebar / history pick up the new session
      router.refresh();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-8"
      >
        {empty ? (
          <div className="max-w-3xl mx-auto text-center pt-10">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-surface-variant items-center justify-center mb-6">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontSize: "28px" }}
              >
                auto_awesome
              </span>
            </div>
            <h2 className="font-headline text-headline-lg text-on-surface mb-3">
              What would you like to explore?
            </h2>
            <p className="font-body text-body-md text-on-surface-variant">
              Ask me about majors, careers, universities, or your next step.
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
              <MessageBubble key={i} msg={m} />
            ))}
            {streaming && messages[messages.length - 1]?.content === "" && (
              <TypingIndicator />
            )}
          </div>
        )}
      </div>

      {/* Quick replies */}
      {!empty && !streaming && (
        <div className="px-4 md:px-8 pb-3">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2 justify-center">
            {QUICK_REPLIES.map((q) => (
              <SuggestionChip key={q} label={q} onClick={() => send(q)} />
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 md:px-8 pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="bg-error-container/40 text-on-error-container px-4 py-3 rounded-lg text-body-sm mb-3">
              {error}
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
              placeholder="Ask about majors, careers, universities…"
              className="flex-1 bg-transparent outline-none text-on-surface font-body text-body-md placeholder:text-on-surface-variant/70 py-2 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="Send"
              className="w-10 h-10 rounded-full bg-cta-gradient flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "20px" }}
              >
                arrow_upward
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
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

  return (
    <div className="msg-in flex gap-3 items-start">
      <div className="shrink-0 w-8 h-8 rounded-full bg-cta-gradient flex items-center justify-center">
        <span
          className="material-symbols-outlined text-white"
          style={{ fontSize: "16px" }}
        >
          auto_awesome
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
          Advisor AI
        </p>
        <div className="bg-surface-container-high rounded-2xl rounded-tl-md px-5 py-4">
          <p className="font-body text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
            {msg.content || " "}
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start msg-in">
      <div className="shrink-0 w-8 h-8 rounded-full bg-cta-gradient flex items-center justify-center">
        <span
          className="material-symbols-outlined text-white"
          style={{ fontSize: "16px" }}
        >
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
