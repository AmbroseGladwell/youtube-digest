import { describe, expect, it } from "vitest";
import {
  isAllowedYouTubeUrl,
  isYouTubeFetchMessage,
  isYouTubeFetchReply,
  YOUTUBE_FETCH,
} from "./youTubeFetchBridge.js";

// The worker's message handler is reachable by any content script on any page the
// extension runs in. Without the allowlist the extension is an open CORS proxy for
// everything in host_permissions (docs/features/transcript-retrieval.md).
describe("isAllowedYouTubeUrl", () => {
  it("allows the YouTube origins the extension holds permissions for", () => {
    expect(isAllowedYouTubeUrl("https://www.youtube.com/youtubei/v1/player")).toBe(true);
    expect(isAllowedYouTubeUrl("https://m.youtube.com/api/timedtext?v=abc")).toBe(true);
  });

  it("refuses the other hosts the extension can reach, which is the point of it", () => {
    expect(isAllowedYouTubeUrl("https://api.anthropic.com/v1/messages")).toBe(false);
    expect(isAllowedYouTubeUrl("https://api.supadata.ai/v1/transcript")).toBe(false);
  });

  it("refuses a lookalike host rather than matching on the name appearing in it", () => {
    expect(isAllowedYouTubeUrl("https://www.youtube.com.evil.test/player")).toBe(false);
    expect(isAllowedYouTubeUrl("https://evil.test/?x=https://www.youtube.com")).toBe(false);
  });

  it("refuses plain http, so a downgraded request cannot be read in the middle", () => {
    expect(isAllowedYouTubeUrl("http://www.youtube.com/youtubei/v1/player")).toBe(false);
  });

  it("refuses anything that is not a url at all, rather than throwing at the caller", () => {
    expect(isAllowedYouTubeUrl("not a url")).toBe(false);
    expect(isAllowedYouTubeUrl("")).toBe(false);
  });
});

describe("the message guards", () => {
  it("recognises a fetch message carrying a request", () => {
    expect(isYouTubeFetchMessage({ type: YOUTUBE_FETCH, request: { url: "https://www.youtube.com" } })).toBe(
      true,
    );
  });

  it("rejects the worker's other conversations, and a message with no request on it", () => {
    expect(isYouTubeFetchMessage({ type: "overview/request-overview", videoUrl: "x" })).toBe(false);
    expect(isYouTubeFetchMessage({ type: YOUTUBE_FETCH })).toBe(false);
    expect(isYouTubeFetchMessage(null)).toBe(false);
  });

  it("treats a failure reply as a reply, because the worker answers rather than rejecting", () => {
    expect(isYouTubeFetchReply({ ok: false, message: "nope" })).toBe(true);
    expect(isYouTubeFetchReply(undefined)).toBe(false);
  });
});
