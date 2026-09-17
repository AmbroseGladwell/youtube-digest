import { describe, expect, it } from "vitest";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

describe("youtubeTimestampUrl", () => {
  it("adds a bare-seconds t= param to a standard watch URL, matching YouTube's own share links", () => {
    expect(youtubeTimestampUrl("https://www.youtube.com/watch?v=abc123", 135_000)).toBe(
      "https://www.youtube.com/watch?v=abc123&t=135",
    );
  });

  it("adds a t= param to a youtu.be short link with no existing query", () => {
    expect(youtubeTimestampUrl("https://youtu.be/abc123", 5_000)).toBe("https://youtu.be/abc123?t=5");
  });

  it("preserves an existing query param, such as youtu.be's own si= share token", () => {
    expect(youtubeTimestampUrl("https://youtu.be/abc123?si=XO0p8bppikm6Ya6v", 92_000)).toBe(
      "https://youtu.be/abc123?si=XO0p8bppikm6Ya6v&t=92",
    );
  });

  it("floors sub-second precision", () => {
    expect(youtubeTimestampUrl("https://www.youtube.com/watch?v=abc123", 1_999)).toBe(
      "https://www.youtube.com/watch?v=abc123&t=1",
    );
  });
});
