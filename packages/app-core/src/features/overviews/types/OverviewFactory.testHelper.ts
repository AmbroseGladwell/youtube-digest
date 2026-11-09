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
  recipe: null,
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

export const makeRecipeOverview = (overrides: Partial<Overview> = {}): Overview =>
  makeOverview({
    source: {
      kind: "web",
      id: VideoId.parse("fedcba9876543210fedcba9876543210"),
      url: "https://examplekitchen.example/recipes/charred-leek-white-bean-stew",
      title: "Charred leek and white bean stew",
      siteName: "Example Kitchen",
      author: "Maya Okafor",
      publishedAt: "2026-10-28T09:00:00.000Z",
      language: "en",
      imageUrl: null,
      wordCount: 2070,
    },
    inOneLine: "A weeknight stew built on charred leeks.",
    coreClaim: "",
    keyPoints: [],
    tags: ["stews", "weeknight", "leeks"],
    recipe: {
      summary:
        "Okafor's weeknight stew rests on one idea: roast the leeks hard before they go in, so the char flavours the whole pot.",
      ingredients: [
        "3 large leeks, trimmed and halved lengthways",
        "3 tbsp olive oil, plus extra to serve",
        "2 × 400g tins cannellini beans, drained",
        "500ml vegetable stock",
        "1 lemon, zested and juiced",
        "A handful of parsley, roughly chopped",
        "50g parmesan, finely grated",
        "Salt and black pepper",
      ],
      steps: [
        { text: "Heat the oven to 220°C (200°C fan) and roast the leeks for 20 to 25 minutes.", group: null },
        { text: "Warm the rest of the oil and cook the garlic gently for 3 minutes.", group: null },
        { text: "Add the beans and stock and simmer for 15 minutes.", group: "For the stew" },
        { text: "Stir the leeks through with the lemon, and serve.", group: "For the stew" },
      ],
      stepCount: 4,
      prepMinutes: 15,
      cookMinutes: 50,
      totalMinutes: 65,
      yield: "4 servings",
    },
    ...overrides,
  });

// A recipe video, modelled on the jollof test (designs 122a–122u).
export const makeRecipeVideoOverview = (overrides: Partial<Overview> = {}): Overview => {
  const video = makeOverview();
  return makeOverview({
    source: { ...video.source, title: "Party jollof rice at home", channel: "Kitchen with Ada", durationMs: 872_000 },
    inOneLine: "Party jollof, scaled down for six.",
    coreClaim: "",
    keyPoints: [],
    verdict: null,
    selling: null,
    howToApply: null,
    watchAnyway: null,
    tags: ["jollof", "rice"],
    chapters: [
      { title: "Why party jollof tastes different", summary: "Cooking for fifty, and the smoky bottom of the pot.", startMs: 0, endMs: 65_000 },
      { title: "The pepper base", summary: "Blending, boiling it down and frying it.", startMs: 65_000, endMs: 400_000 },
      { title: "Tasting, and leftovers", summary: "She tastes and adjusts the salt.", startMs: 400_000, endMs: 872_000 },
    ],
    recipe: {
      summary: "Ada scales down the jollof she cooks for parties, and says the whole dish rests on the pepper base.",
      ingredients: ["3 cups long-grain parboiled rice", "5 plum tomatoes", "Salt, to taste", "Fried plantain, to serve"],
      steps: [
        { text: "Blend the tomatoes and peppers until smooth.", group: null, range: { startMs: 65_000, endMs: 130_000 } },
        { text: "Fry the base until the oil rises to the top.", group: null, range: { startMs: 252_000, endMs: 340_000 } },
        { text: "Serve with fried plantain.", group: null },
      ],
      stepCount: 3,
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      yield: "Serves 6",
      ingredientsSaid: [3],
    },
    ...overrides,
  });
};

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
