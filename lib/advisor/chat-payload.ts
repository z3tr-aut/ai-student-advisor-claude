/**
 * Streaming sentinel used to attach a structured schedule payload to an
 * assistant message. The chat API appends one of these blocks AFTER the
 * natural text when build_schedule produced picks; the client strips the
 * block from display and parses the JSON between markers into `metadata`.
 *
 * Persisted in the chat_messages.metadata jsonb column for replay.
 */
export const SCHEDULE_PAYLOAD_OPEN = "<<__SCHEDULE_PAYLOAD__>>";
export const SCHEDULE_PAYLOAD_CLOSE = "<<__END_SCHEDULE_PAYLOAD__>>";

export type SchedulePick = {
  schedule_id: string;
  course_id: string;
  course_name: string;
  credits: number;
  day: string;
  start_time: string;
  end_time: string;
  room_id?: string;
};

export type ScheduleMessageMetadata = {
  kind: "schedule";
  picks: SchedulePick[];
  total_credits: number;
};

export type MessageMetadata = ScheduleMessageMetadata;

/** Wrap a payload as a streaming sentinel block. Server-side. */
export function encodeSchedulePayload(payload: ScheduleMessageMetadata): string {
  return `\n\n${SCHEDULE_PAYLOAD_OPEN}\n${JSON.stringify(payload)}\n${SCHEDULE_PAYLOAD_CLOSE}\n`;
}

/**
 * Split a (possibly streaming) chat string into the user-visible text and the
 * parsed payload, if any. Tolerates an unclosed sentinel: if `OPEN` was seen
 * but `CLOSE` hasn't arrived yet, returns the text up to `OPEN` and `null`
 * metadata so the UI doesn't flash partial JSON.
 */
export function splitSchedulePayload(raw: string): {
  text: string;
  metadata: MessageMetadata | null;
} {
  const openIdx = raw.indexOf(SCHEDULE_PAYLOAD_OPEN);
  if (openIdx < 0) return { text: raw, metadata: null };

  const text = raw.slice(0, openIdx).trimEnd();
  const closeIdx = raw.indexOf(SCHEDULE_PAYLOAD_CLOSE, openIdx);
  if (closeIdx < 0) return { text, metadata: null };

  const jsonRaw = raw.slice(openIdx + SCHEDULE_PAYLOAD_OPEN.length, closeIdx).trim();
  try {
    const parsed = JSON.parse(jsonRaw) as MessageMetadata;
    return { text, metadata: parsed };
  } catch {
    return { text, metadata: null };
  }
}
