import { createClient } from "@/lib/supabase/server";
import ChatClient from "./ChatClient";
import type { MessageMetadata } from "@/lib/advisor/chat-payload";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { prompt?: string; session?: string; new?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load existing session if ?session=<id>
  let initialMessages: {
    role: "user" | "assistant";
    content: string;
    metadata?: MessageMetadata | null;
  }[] = [];
  let sessionId: string | null = null;
  let sessionTitle: string | null = null;

  if (searchParams.session && !searchParams.new) {
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id, title")
      .eq("id", searchParams.session)
      .eq("user_id", user!.id)
      .single();

    if (session) {
      sessionId = session.id;
      sessionTitle = session.title;
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("role, content, metadata")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });
      initialMessages = (msgs ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          metadata: (m.metadata as MessageMetadata | null) ?? null,
        }));
    }
  }

  // Pull profile so system prompt can personalise
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, interests, skills, preferred_countries, grades, education_level, bio")
    .eq("id", user!.id)
    .single();

  return (
    <ChatClient
      initialMessages={initialMessages}
      initialSessionId={sessionId}
      initialTitle={sessionTitle}
      seedPrompt={searchParams.prompt ?? null}
      profile={profile ?? null}
    />
  );
}
