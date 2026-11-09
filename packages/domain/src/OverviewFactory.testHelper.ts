import { randomUUID } from "node:crypto";
import { OverviewId, SourceKey, VideoId } from "./Brands.js";
import type { RecipeNote } from "./RecipeNote.js";
import type { Overview } from "./Overview.js";
import type { WebSource, YouTubeSource } from "./Source.js";

export type VideoOverview = Overview & { source: YouTubeSource };

export const makeOverview = (overrides: Partial<Overview> = {}): VideoOverview =>
  ({
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
    article: null,
    recipe: null,
    inOneLine: "A short description of the video.",
    bigPicture: null,
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
    ...overrides,
  }) as VideoOverview;

export const RECIPE_SOURCE: WebSource = {
  kind: "web",
  id: SourceKey.parse("0123456789abcdef0123456789abcdef"),
  url: "https://examplekitchen.example/recipes/charred-leek-white-bean-stew",
  title: "Charred leek and white bean stew",
  siteName: "Example Kitchen",
  author: "Maya Okafor",
  publishedAt: null,
  language: "en",
  imageUrl: null,
  wordCount: 2070,
};

export const makeRecipeOverview = (recipe: Partial<RecipeNote> = {}, overrides: Partial<Overview> = {}): Overview =>
  makeOverview({
    source: RECIPE_SOURCE,
    inOneLine: "A weeknight stew built on charred leeks.",
    bigPicture: null,
    coreClaim: "",
    keyPoints: [],
    recipe: {
      summary: "Okafor's weeknight stew rests on one idea: roast the leeks hard before they go in.",
      ingredients: ["3 large leeks, trimmed", "2 × 400g tins cannellini beans, drained", "Salt and black pepper"],
      steps: [
        { text: "Roast the leeks for 20 minutes.", group: null },
        { text: "Simmer the beans in the stock.", group: "For the beans" },
        { text: "Stir the leeks through.", group: "For the beans" },
      ],
      stepCount: 3,
      prepMinutes: 15,
      cookMinutes: 50,
      totalMinutes: 65,
      yield: "4 servings",
      ...recipe,
    },
    ...overrides,
  });
