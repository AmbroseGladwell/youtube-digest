import type { YouTubeFetchRequest, YouTubeFetchResponse } from "@overview/app-core";

// The panel asks, the worker fetches. The worker is the only document whose
// host_permissions exempt it from CORS for youtube.com, and the only one that is always
// there to be asked (docs/features/transcript-retrieval.md).
export const YOUTUBE_FETCH = "overview/youtube-fetch";

export interface YouTubeFetchMessage {
  type: typeof YOUTUBE_FETCH;
  request: YouTubeFetchRequest;
}

// A reply rather than a rejection, because a throw inside a sendMessage handler reaches
// the caller as an opaque lastError with nothing in it to act on.
export type YouTubeFetchReply =
  | { ok: true; response: YouTubeFetchResponse }
  | { ok: false; message: string };

export const isYouTubeFetchMessage = (message: unknown): message is YouTubeFetchMessage =>
  typeof message === "object" &&
  message !== null &&
  (message as { type?: unknown }).type === YOUTUBE_FETCH &&
  typeof (message as { request?: unknown }).request === "object" &&
  (message as { request: unknown }).request !== null;

export const isYouTubeFetchReply = (reply: unknown): reply is YouTubeFetchReply =>
  typeof reply === "object" && reply !== null && typeof (reply as { ok?: unknown }).ok === "boolean";

// This handler is reachable by any content script on any page the extension runs in, so
// without it the extension is an open CORS proxy for everything in host_permissions —
// api.anthropic.com included. It is a security boundary, not caution.
const ALLOWED_ORIGINS = new Set(["https://www.youtube.com", "https://m.youtube.com"]);

export function isAllowedYouTubeUrl(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}
