import { randomUUID } from "node:crypto";
import { OverviewId, type Overview } from "@overview/types";

export function makeOverview(overrides: Partial<Overview> = {}): Overview {
  return {
    id: OverviewId.parse(randomUUID()),
    video: {
      url: "https://www.youtube.com/watch?v=example",
      title: "Example",
      channel: "Example Channel",
      description: null,
      durationMs: null,
    },
    savedAt: new Date().toISOString(),
    savedNote: null,
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
