import {
  DEFAULT_OVERVIEW_STATE,
  OverviewId,
  VideoId,
  type Overview,
  type OverviewState,
  type UnreadableRecord,
  type YouTubeSource,
} from "@overview/domain";
import type { LibraryEntry } from "./LibraryEntry.js";
import type { OverviewWithState } from "./OverviewWithState.js";

export type VideoOverview = Overview & { source: YouTubeSource };

export const makeOverview = (overrides: Partial<Overview> = {}): VideoOverview => ({
  id: OverviewId.parse(crypto.randomUUID()),
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
  article: null,
  inOneLine: "A short description of the video.",
  coreClaim: "The single assertion this video makes.",
  thin: false,
  keyPoints: [{ text: "one", range: null }, { text: "two", range: null }, { text: "three", range: null }],
  topicIds: [],
  tags: ["one-tag", "two-tag", "three-tag"],
  verdict: null,
  selling: null,
  howToApply: null,
  watchAnyway: null,
  chapters: null,
  ...overrides,
}) as VideoOverview;

export const makeOverviewState = (overviewId: string, overrides: Partial<OverviewState> = {}): OverviewState => ({
  overviewId: OverviewId.parse(overviewId),
  ...DEFAULT_OVERVIEW_STATE,
  ...overrides,
});

export const makeArticleOverview = (overrides: Partial<Overview> = {}): Overview =>
  makeOverview({
    source: {
      kind: "web",
      id: VideoId.parse("0123456789abcdef0123456789abcdef"),
      url: "https://theharbourpost.example/2026/11/bridge-bill-twice",
      title: "The town that pays its bridge bill twice",
      siteName: "The Harbour Post",
      author: "Asha Rao",
      publishedAt: "2026-11-01T09:00:00.000Z",
      language: "en",
      imageUrl: null,
      wordCount: 3220,
    },
    keyPoints: [
      { text: "The county reused a survey from 2011. Rao says nobody inspected the bridge again.", range: null },
      { text: "Half the bill falls on council tax. A water levy covers the rest.", range: null },
      { text: "The tender rose from four million to eight million pounds.", range: null },
    ],
    article: {
      chapters: [
        { title: "How the survey went wrong", summary: "Rao traces the repair back to a 2011 survey.", place: { anchor: null, quote: "The bridge has been closed since March" }, wordCount: 690 },
        { title: "Who pays", summary: "She sets out how the bill is split.", place: { anchor: "who-pays", quote: "The county offered half" }, wordCount: 460 },
        { title: "The budget, line by line", summary: "The tender figures year by year.", place: { anchor: null, quote: "Each line of the tender" }, wordCount: 920 },
      ],
      keyPointChapters: [0, 1, 2],
      readAnyway: {
        answer: "partial",
        reason: "The budget chapter has figures you would want to check yourself.",
        leftOut: "It leaves out the line-by-line costs and the engineer's letter.",
        chapterIndexes: [2],
      },
    },
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
        source: {
          kind: "youtube",
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
