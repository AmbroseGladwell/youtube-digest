import {
  DEFAULT_OVERVIEW_STATE,
  OverviewId,
  VideoId,
  type Overview,
  type OverviewState,
  type UnreadableRecord,
} from "@overview/domain";
import type { LibraryEntry } from "./LibraryEntry.js";
import type { OverviewWithState } from "./OverviewWithState.js";

export const makeOverview = (overrides: Partial<Overview> = {}): Overview => ({
  id: OverviewId.parse(crypto.randomUUID()),
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
});

export const makeOverviewState = (overviewId: string, overrides: Partial<OverviewState> = {}): OverviewState => ({
  overviewId: OverviewId.parse(overviewId),
  ...DEFAULT_OVERVIEW_STATE,
  ...overrides,
});

export const makeOverviewWithState = (
  overviewOverrides: Partial<Overview> = {},
  stateOverrides: Partial<OverviewState> = {},
): { kind: "overview" } & OverviewWithState => {
  const overview = makeOverview(overviewOverrides);
  return { kind: "overview", overview, state: makeOverviewState(overview.id, stateOverrides) };
};

export const makeUnreadableEntry = (
  recordOverrides: Partial<UnreadableRecord> = {},
  stateOverrides: Partial<OverviewState> = {},
): LibraryEntry => {
  const id = recordOverrides.id ?? crypto.randomUUID();
  return {
    kind: "unreadable",
    record: {
      kind: "overview",
      id,
      schemaVersion: 1,
      reason: "invalid",
      detail: "coreClaim: expected string",
      salvaged: {
        savedAt: new Date().toISOString(),
        video: {
          id: VideoId.parse("example"),
          url: "https://www.youtube.com/watch?v=example",
          title: "Example",
        },
      },
      ...recordOverrides,
    },
    state: makeOverviewState(id, stateOverrides),
  };
};
