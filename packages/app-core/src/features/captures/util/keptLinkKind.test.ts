import { describe, expect, it } from "vitest";
import { keptLinkKind } from "./keptLinkKind.js";

describe("keptLinkKind", () => {
  it("tells a YouTube video, a TikTok and an article apart by their address", () => {
    expect(keptLinkKind({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", source: null })).toBe("youtube");
    expect(keptLinkKind({ url: "https://www.tiktok.com/@cook/video/7301234567890123456", source: null })).toBe("tiktok");
    expect(keptLinkKind({ url: "https://news.example.com/2026/11/bridges", source: null })).toBe("article");
  });
});
