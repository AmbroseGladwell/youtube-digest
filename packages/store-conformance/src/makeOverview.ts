import { randomUUID } from "node:crypto";
import { OverviewId, VideoId, type Overview } from "@overview/domain";
import type { YouTubeSource } from "@overview/domain";

export type VideoOverview = Overview & { source: YouTubeSource };

export function makeOverview(overrides: Partial<Overview> = {}): VideoOverview {
  return {
    id: OverviewId.parse(randomUUID()),
    source: {
      kind: "youtube",
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
    fromPlaylist: null,
    madeOn: null,
    inOneLine: "A short description of the video.",
    bigPicture: null,
    sourceSteps: null,
    coreClaim: "The single assertion this video makes.",
    thin: false,
    keyPoints: [
      { text: "one", range: null },
      { text: "two", range: null },
      { text: "three", range: null },
    ],
    topicIds: [],
    tags: ["one-tag", "two-tag", "three-tag"],
    verdict: null,
    selling: null,
    howToApply: null,
    watchAnyway: null,
    chapters: null,
    article: null,
    recipe: null,
    ...overrides,
  } as VideoOverview;
}
