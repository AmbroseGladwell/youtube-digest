import { randomUUID } from "node:crypto";
import { OverviewId, VideoId, type Overview } from "@overview/domain";

export function makeOverview(overrides: Partial<Overview> = {}): Overview {
  return {
    id: OverviewId.parse(randomUUID()),
    video: {
      id: VideoId.parse("example"),
      url: "https://www.youtube.com/watch?v=example",
      title: "Example",
      channel: "Example Channel",
      description: null,
      durationMs: null,
      publishedAt: null,
      thumbnailUrl: null,
    },
    savedAt: new Date().toISOString(),
    captureReason: null,
    inOneLine: "A short description of the video.",
    coreClaim: "The single assertion this video makes.",
    thin: false,
    keyPoints: ["one", "two", "three"],
    topicIds: [],
    tags: ["one-tag", "two-tag", "three-tag"],
    verdict: null,
    selling: null,
    howToApply: null,
    watchAnyway: null,
    ...overrides,
  };
}
