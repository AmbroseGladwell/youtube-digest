import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

describe("youtubeTimestampUrl", () => {
  it("adds a bare-seconds t= param to a standard watch URL, matching YouTube's own share links", () => {
    assert.equal(youtubeTimestampUrl("https://www.youtube.com/watch?v=abc123", 135_000), "https://www.youtube.com/watch?v=abc123&t=135");
  });

  it("adds a t= param to a youtu.be short link with no existing query", () => {
    assert.equal(youtubeTimestampUrl("https://youtu.be/abc123", 5_000), "https://youtu.be/abc123?t=5");
  });

  it("preserves an existing query param, such as youtu.be's own si= share token", () => {
    assert.equal(youtubeTimestampUrl("https://youtu.be/abc123?si=XO0p8bppikm6Ya6v", 92_000), "https://youtu.be/abc123?si=XO0p8bppikm6Ya6v&t=92");
  });

  it("floors sub-second precision", () => {
    assert.equal(youtubeTimestampUrl("https://www.youtube.com/watch?v=abc123", 1_999), "https://www.youtube.com/watch?v=abc123&t=1");
  });
});
