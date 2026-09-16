import { describe, expect, it } from "vitest";
import { extractYouTubeVideoId, isYouTubeUrl } from "./parseYouTubeUrl.js";

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

describe("isYouTubeUrl", () => {
  it("mirrors extractYouTubeVideoId's success/failure", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://vimeo.com/12345")).toBe(false);
  });
});
