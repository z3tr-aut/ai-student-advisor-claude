import { createClient } from "@/lib/supabase/server";
import ChatClient from "./ChatClient";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { prompt?: string; session?: string; new?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resume a conversation unless the user explicitly asked for a new one.
  // - ?session=<id>  → that session
  // - (no params)    → the user's most recent session (so navigating away from
  //                     Chat Home and back doesn't lose the conversation)
  // - ?new=1         → start blank
  let initialMessages: { role: "user" | "assistant"; content: string }[] = [];
  let sessionId: string | null = null;
  let sessionTitle: string | null = null;

  if (!searchParams.new) {
    let session: { id: string; title: string | null } | null = null;

    if (searchParams.session) {
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title")
        .eq("id", searchParams.session)
        .eq("user_id", user!.id)
        .maybeSingle();
      session = data ?? null;
    } else {
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      session = data ?? null;
    }

    if (session) {
      sessionId = session.id;
      sessionTitle = session.title;
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });
      initialMessages = (msgs ?? []).filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          m.role === "user" || m.role === "assistant",
      );
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
