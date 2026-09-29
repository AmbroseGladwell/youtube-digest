import { describe, expect, it } from "vitest";
import { canonicalYouTubeUrl, extractYouTubeVideoId, isYouTubeUrl } from "./parseYouTubeUrl.js";

describe("extractYouTubeVideoId", () => {
  it("reads the v= param from a standard watch URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads the id from a youtu.be short link", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads the id from a shorts URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads the id from an embed URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts a bare mobile host", () => {
    expect(extractYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads the id from a live URL, as the iOS share sheet gives for a past stream", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/live/TOk-DUDmN6E?is=2_N5yomNqBmNf2yl")).toBe(
      "TOk-DUDmN6E",
    );
  });

  it("reads the id from a /v/ URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts YouTube Music", () => {
    expect(extractYouTubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts a privacy-enhanced embed", () => {
    expect(extractYouTubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc123",
    "https://youtu.be/dQw4w9WgXcQ?si=abc123",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ?si=abc123",
    "https://www.youtube.com/live/dQw4w9WgXcQ?si=abc123",
  ])("ignores share-tracking params on %s", (url) => {
    expect(extractYouTubeVideoId(url)).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a channel's live page, which names no video", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/@somechannel/live")).toBeNull();
  });

  it("returns null for a non-YouTube URL", () => {
    expect(extractYouTubeVideoId("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null for a YouTube URL with no video id", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/")).toBeNull();
  });

  it("returns null for text that isn't a URL at all", () => {
    expect(extractYouTubeVideoId("not a url")).toBeNull();
  });
});

describe("canonicalYouTubeUrl", () => {
  it.each([
    "https://www.youtube.com/live/TOk-DUDmN6E?is=2_N5yomNqBmNf2yl",
    "https://youtu.be/TOk-DUDmN6E?t=30",
    "https://m.youtube.com/watch?v=TOk-DUDmN6E&si=abc123",
    "https://www.youtube.com/shorts/TOk-DUDmN6E",
  ])("turns %s into the plain watch URL", (url) => {
    expect(canonicalYouTubeUrl(url)).toBe("https://www.youtube.com/watch?v=TOk-DUDmN6E");
  });

  it("returns null for a non-YouTube URL", () => {
    expect(canonicalYouTubeUrl("https://vimeo.com/12345")).toBeNull();
  });
});

describe("isYouTubeUrl", () => {
  it("mirrors extractYouTubeVideoId's success/failure", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://vimeo.com/12345")).toBe(false);
  });
});
