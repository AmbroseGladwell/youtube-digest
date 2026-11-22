import type { YouTubeFetchRequest, YouTubeFetchResponse } from "@overview/app-core";

// docs/features/transcript-retrieval.md, "Which document actually holds the privilege".
export const YOUTUBE_FETCH = "overview/youtube-fetch";

export interface YouTubeFetchMessage {
  type: typeof YOUTUBE_FETCH;
  request: YouTubeFetchRequest;
}

// A reply, not a rejection: a throw in a sendMessage handler reaches the caller as an opaque lastError.
export type YouTubeFetchReply = { ok: true; response: YouTubeFetchResponse } | { ok: false; message: string };

export const isYouTubeFetchMessage = (message: unknown): message is YouTubeFetchMessage =>
  typeof message === "object" &&
  message !== null &&
  (message as { type?: unknown }).type === YOUTUBE_FETCH &&
  typeof (message as { request?: unknown }).request === "object" &&
  (message as { request: unknown }).request !== null;

export const isYouTubeFetchReply = (reply: unknown): reply is YouTubeFetchReply =>
  typeof reply === "object" && reply !== null && typeof (reply as { ok?: unknown }).ok === "boolean";

// docs/features/transcript-retrieval.md, "The allowlist is a security boundary".
const ALLOWED_ORIGINS = new Set(["https://www.youtube.com", "https://m.youtube.com"]);

export const isAllowedYouTubeUrl = (url: string): boolean => {
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
};
