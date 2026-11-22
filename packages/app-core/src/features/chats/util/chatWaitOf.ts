import { SyncRequestError } from "@overview/sync";

export type ChatWait =
  | { kind: "month"; resetsOn: string | null }
  | { kind: "libraryMonth"; resetsOn: string | null }
  | { kind: "day"; retryAfterSeconds: number | null }
  | { kind: "everyone"; retryAfterSeconds: number | null }
  | { kind: "conversationFull" }
  | { kind: "noSource" };

const seconds = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

// The endpoint's refusals that are waits or states, not failures: each limit with when it
// lifts, a conversation at its length, and an overview with nothing to answer from
// (docs/features/chats.md, "Asking"). Anything else is null and is a failure.
export const chatWaitOf = (error: unknown): ChatWait | null => {
  if (!(error instanceof SyncRequestError)) {
    return null;
  }
  const details = error.details ?? {};
  if (error.code === "transcript_unavailable" && details.chat === "no-source") {
    return { kind: "noSource" };
  }
  if (error.code === "invalid_request" && details.conversation === "full") {
    return { kind: "conversationFull" };
  }
  if (error.code !== "too_many_requests") {
    return null;
  }
  switch (details.quota) {
    case "chat-month": {
      const resetsOn = typeof details.resetsOn === "string" ? details.resetsOn : null;
      return details.scope === "library" ? { kind: "libraryMonth", resetsOn } : { kind: "month", resetsOn };
    }
    case "chat-day":
      return { kind: "day", retryAfterSeconds: seconds(details.retryAfterSeconds) };
    case "chat-our-key-daily":
      return { kind: "everyone", retryAfterSeconds: seconds(details.retryAfterSeconds) };
    default:
      return null;
  }
};
