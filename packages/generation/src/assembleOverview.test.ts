import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, TopicId, VideoId } from "@overview/domain";
import { assembleOverview, assembleRecipeVideoOverview } from "./assembleOverview.js";
import { GenerationError } from "./GenerationError.js";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput, GeneratedRecipeVideoOutput } from "./GeneratedOutput.js";

const fitnessId = TopicId.parse(randomUUID());
const financeId = TopicId.parse(randomUUID());

const baseInput: GenerationInput = {
  video: {
    id: VideoId.parse("example"),
    url: "https://www.youtube.com/watch?v=example",
    title: "Example",
    channel: "Example Channel",
    description: null,
    durationMs: 600000,
    publishedAt: null,
    thumbnailUrl: null,
  },
  transcript: [
    { text: "Hello and welcome.", startMs: 0, endMs: 2000 },
    { text: "Here is the technique.", startMs: 2000, endMs: 8000 },
    { text: "That's everything.", startMs: 8000, endMs: 9000 },
  ],
  captureReason: null,
  readerContext: null,
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  existingTopics: [
    { id: fitnessId, name: "fitness", description: null, createdAt: new Date().toISOString() },
    { id: financeId, name: "finance", description: null, createdAt: new Date().toISOString() },
  ],
  existingTags: [],
  tagAliases: {},
  pastClaims: [{ overviewId: OverviewId.parse(randomUUID()), title: "An older video", claim: "Do the thing." }],
};

const baseOutput: GeneratedOutput = {
  inOneLine: "A short description.",
  sourceSteps: [],
  bigPicture: "",
  coreClaim: "The core claim of the video.",
  thin: false,
  keyPoints: [
    { text: "one", startSegmentIndex: -1, endSegmentIndex: -1 },
    { text: "two", startSegmentIndex: -1, endSegmentIndex: -1 },
    { text: "three", startSegmentIndex: -1, endSegmentIndex: -1 },
  ],
  chapters: [{ title: "The whole thing", summary: "One stretch.", startSegmentIndex: 0 }],
  matchedTopicNames: ["fitness"],
  suggestedTopic: null,
  tags: ["one-tag", "two-tag", "three-tag"],
};

const meta = { id: OverviewId.parse(randomUUID()), savedAt: new Date().toISOString() };

test("matched topic names map to the corresponding topic ids, unmatched names are ignored", () => {
  const overview = assembleOverview(baseInput, { ...baseOutput, matchedTopicNames: ["fitness", "some-made-up-name"] }, meta);
  assert.deepEqual(overview.topicIds, [fitnessId]);
});

test("no matches means unsorted, not an error", () => {
  const overview = assembleOverview(baseInput, { ...baseOutput, matchedTopicNames: [] }, meta);
  assert.deepEqual(overview.topicIds, []);
});

test("a thin overview never carries a verdict, even if the model produced one", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      thin: true,
      verdict: {
        novelty: "original",
        standsOut: { text: "A new idea.", startSegmentIndex: -1, endSegmentIndex: -1 },
        dubiousClaims: [],
        reasoning: "x",
        similarToIndices: [],
      },
    },
    meta,
  );
  assert.equal(overview.verdict, null);
});

test("similarToIndices resolve to the matching past claim, out-of-range indices are dropped", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      verdict: { novelty: "common_knowledge", standsOut: null, dubiousClaims: [], reasoning: "x", similarToIndices: [0, 5, -1] },
    },
    meta,
  );
  assert.equal(overview.verdict?.similarTo.length, 1);
  assert.equal(overview.verdict?.similarTo[0]?.title, "An older video");
});

test("common knowledge never names what stands out, even if the model did", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      verdict: {
        novelty: "common_knowledge",
        standsOut: { text: "Nothing much.", startSegmentIndex: -1, endSegmentIndex: -1 },
        dubiousClaims: [],
        reasoning: "x",
        similarToIndices: [],
      },
    },
    meta,
  );
  assert.equal(overview.verdict?.standsOut, null);
});

test("a fresh angle keeps what stands out, and a blank one reads as missing", () => {
  const verdict = (text: string) =>
    assembleOverview(
      baseInput,
      {
        ...baseOutput,
        verdict: {
          novelty: "fresh_angle",
          standsOut: { text, startSegmentIndex: -1, endSegmentIndex: -1 },
          dubiousClaims: [],
          reasoning: "x",
          similarToIndices: [],
        },
      },
      meta,
    ).verdict;
  assert.deepEqual(verdict(" A worked drawdown spreadsheet. ")?.standsOut, { text: "A worked drawdown spreadsheet.", range: null });
  assert.equal(verdict("  ")?.standsOut, null);
});

test("what stands out is timed from the transcript, and a range that does not fit is dropped rather than failing the overview", () => {
  const standsOut = (range: { startSegmentIndex: number; endSegmentIndex: number }) =>
    assembleOverview(
      baseInput,
      {
        ...baseOutput,
        verdict: {
          novelty: "original",
          standsOut: { text: "A trial.", ...range },
          dubiousClaims: [],
          reasoning: "x",
          similarToIndices: [],
        },
      },
      meta,
    ).verdict?.standsOut;

  assert.deepEqual(standsOut({ startSegmentIndex: 1, endSegmentIndex: 2 })?.range, { startMs: 2000, endMs: 9000 });
  assert.equal(standsOut({ startSegmentIndex: 1, endSegmentIndex: 3 })?.range, null);
  assert.equal(standsOut({ startSegmentIndex: 2, endSegmentIndex: 1 })?.range, null);
});

const DUBIOUS_CLAIM = {
  claim: "Here is the technique.",
  basis: "contradictsSettled" as const,
  reason: "Nothing settled backs it.",
  segmentIndex: 1,
};

test("a verdict naming a dubious claim is dubious, and the claim's segment resolves to the transcript's real timestamp", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      verdict: { novelty: "original", standsOut: null, dubiousClaims: [DUBIOUS_CLAIM], reasoning: "x", similarToIndices: [] },
    },
    meta,
  );
  assert.equal(overview.verdict?.dubious, true);
  assert.deepEqual(overview.verdict?.dubiousClaims, [
    { claim: "Here is the technique.", basis: "contradictsSettled", reason: "Nothing settled backs it.", startMs: 2000 },
  ]);
});

test("a verdict naming no dubious claim is not dubious", () => {
  const overview = assembleOverview(
    baseInput,
    { ...baseOutput, verdict: { novelty: "original", standsOut: null, dubiousClaims: [], reasoning: "x", similarToIndices: [] } },
    meta,
  );
  assert.equal(overview.verdict?.dubious, false);
  assert.deepEqual(overview.verdict?.dubiousClaims, []);
});

test("a dubious claim made without a transcript has no moment", () => {
  const overview = assembleOverview(
    { ...baseInput, transcript: [] },
    {
      ...baseOutput,
      chapters: [],
      verdict: {
        novelty: "original",
        standsOut: null,
        dubiousClaims: [{ ...DUBIOUS_CLAIM, segmentIndex: null }],
        reasoning: "x",
        similarToIndices: [],
      },
    },
    meta,
  );
  assert.equal(overview.verdict?.dubiousClaims?.[0]?.startMs, null);
});

test("a dubious claim pointing past the transcript is a generation error, not a silent clamp", () => {
  assert.throws(
    () =>
      assembleOverview(
        baseInput,
        {
          ...baseOutput,
          verdict: {
            novelty: "original",
            standsOut: null,
            dubiousClaims: [{ ...DUBIOUS_CLAIM, segmentIndex: 99 }],
            reasoning: "x",
            similarToIndices: [],
          },
        },
        meta,
      ),
    GenerationError,
  );
});

test("selling and how-to-apply pass through untouched when present", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      selling: { type: "none", detail: "Nothing detected.", compromisesContent: false },
      howToApply: { items: ["do this"] },
    },
    meta,
  );
  assert.equal(overview.selling?.type, "none");
  assert.deepEqual(overview.howToApply?.items, ["do this"]);
});

test("selling and how-to-apply are null, not absent, when their section didn't run", () => {
  const overview = assembleOverview(baseInput, baseOutput, meta);
  assert.equal(overview.selling, null);
  assert.equal(overview.howToApply, null);
});

test("a partial watch-it-anyway resolves segment indices to the transcript's real timestamps", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      watchAnyway: {
        answer: "partial",
        reason: "just the technique",
        startSegmentIndex: 1,
        endSegmentIndex: 1,
      },
    },
    meta,
  );
  assert.deepEqual(overview.watchAnyway?.range, { startMs: 2000, endMs: 8000 });
});

test("a watch-it-anyway range pointing past the transcript is a generation error, not a silent clamp", () => {
  assert.throws(
    () =>
      assembleOverview(
        baseInput,
        {
          ...baseOutput,
          watchAnyway: {
            answer: "partial",
            reason: "just the technique",
            startSegmentIndex: 1,
            endSegmentIndex: 99,
          },
        },
        meta,
      ),
    GenerationError,
  );
});

test("chapters take their times from the transcript, each ending where the next begins", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      chapters: [
        { title: "Welcome", summary: "The greeting.", startSegmentIndex: 0 },
        { title: "The technique", summary: "The technique itself.", startSegmentIndex: 1 },
      ],
    },
    { ...meta },
  );
  assert.deepEqual(overview.chapters, [
    { title: "Welcome", summary: "The greeting.", startMs: 0, endMs: 2000 },
    { title: "The technique", summary: "The technique itself.", startMs: 2000, endMs: 9000 },
  ]);
});

// A wordless outro is not part of any chapter, and a wordless intro is not either: the
// first chapter starts at the first caption, wherever that falls.
test("the chapters span the words, not the video: the first starts and the last ends with the captions", () => {
  const overview = assembleOverview(
    {
      ...baseInput,
      video: { ...baseInput.video, durationMs: 600000 },
      transcript: baseInput.transcript.map((segment) => ({
        ...segment,
        startMs: segment.startMs + 12_000,
        endMs: segment.endMs + 12_000,
      })),
    },
    baseOutput,
    meta,
  );
  assert.equal(overview.chapters?.[0]?.startMs, 12_000);
  assert.equal(overview.chapters?.at(-1)?.endMs, 21_000);
});

test("an empty transcript yields an empty chapter list rather than a chapter with no times", () => {
  const overview = assembleOverview({ ...baseInput, transcript: [] }, { ...baseOutput, chapters: [] }, meta);
  assert.deepEqual(overview.chapters, []);
});

test("a chapter pointing past the transcript is a generation error, not a silent clamp", () => {
  assert.throws(
    () => assembleOverview(baseInput, { ...baseOutput, chapters: [{ title: "x", summary: "y", startSegmentIndex: 99 }] }, meta),
    GenerationError,
  );
});

test("a topic the model suggested is not filed under, and does not reach the record", () => {
  const overview = assembleOverview(
    baseInput,
    { ...baseOutput, matchedTopicNames: [], suggestedTopic: { name: "cooking", description: null } },
    meta,
  );
  assert.deepEqual(overview.topicIds, []);
});

test("tags are spelled as the reader's library spells them, and a merged-away tag cannot return", () => {
  const overview = assembleOverview(
    {
      ...baseInput,
      existingTags: [
        { tag: "startup", count: 4 },
        { tag: "saas", count: 3 },
      ],
      tagAliases: { "micro-saas": "saas", nuclear: null },
    },
    { ...baseOutput, tags: ["startups", "micro-saas", "nuclear", "pricing"] },
    meta,
  );
  assert.deepEqual(overview.tags, ["startup", "saas", "pricing"]);
});

const recipeInput: GenerationInput = {
  ...baseInput,
  video: {
    ...baseInput.video,
    description: "Party jollof.",
    fullDescription: "Party jollof.\nServes 6\n\nIngredients\n3 cups long-grain rice\n2 tbsp tomato paste",
  },
  transcript: [
    { text: "Today it's party jollof.", startMs: 0, endMs: 4000 },
    { text: "Fry two and a half tablespoons of the paste until it darkens.", startMs: 4000, endMs: 30000 },
    { text: "Then the rice goes in, cover it for 30 minutes.", startMs: 30000, endMs: 60000 },
  ],
};

const recipeOutput: GeneratedRecipeVideoOutput = {
  inOneLine: "A party jollof with a smoky, fried tomato base.",
  chapters: baseOutput.chapters,
  matchedTopicNames: [],
  suggestedTopic: null,
  tags: baseOutput.tags,
  recipe: {
    summary: "A party jollof whose depth comes from frying the paste until it darkens.",
    ingredients: ["3 cups long-grain rice", "2 tbsp tomato paste", "1 tsp salt", "1 onion (about 150g), sliced"],
    steps: [
      { text: "Fry the paste until it darkens.", group: null, startSegmentIndex: 1, endSegmentIndex: 1 },
      { text: "Stir in the rice and cover for 30 minutes.", group: null, startSegmentIndex: 2, endSegmentIndex: 2 },
      { text: "Serve with fried plantain.", group: null, startSegmentIndex: -1, endSegmentIndex: -1 },
    ],
  },
};

const assembleRecipe = (output: GeneratedRecipeVideoOutput = recipeOutput) => {
  const overview = assembleRecipeVideoOverview(recipeInput, output, meta);
  assert.ok(overview);
  return overview;
};

test("a recipe video's note is its recipe, with its chapters and nothing argument-shaped", () => {
  const overview = assembleRecipe();
  assert.equal(overview.recipe?.summary, recipeOutput.recipe?.summary);
  assert.deepEqual(overview.keyPoints, []);
  assert.equal(overview.coreClaim, "");
  assert.equal(overview.bigPicture, null);
  assert.equal(overview.verdict, null);
  assert.equal(overview.howToApply, null);
  assert.equal(overview.watchAnyway, null);
  assert.equal(overview.chapters?.length, 1);
});

test("a recipe video's steps carry where the video does them, and a step it never shows has no moment", () => {
  const overview = assembleRecipe();
  assert.deepEqual(
    overview.recipe?.steps.map(({ range }) => range),
    [{ startMs: 4000, endMs: 30000 }, { startMs: 30000, endMs: 60000 }, undefined],
  );
});

test("a line the description doesn't list is marked as said in the video", () => {
  const overview = assembleRecipe();
  assert.deepEqual(overview.recipe?.ingredientsSaid, [2, 3]);
});

test("an amount nobody stated is dropped and the ingredient kept", () => {
  const overview = assembleRecipe();
  assert.deepEqual(overview.recipe?.ingredients, ["3 cups long-grain rice", "2 tbsp tomato paste", "salt", "onion, sliced"]);
});

test("a recipe video's yield is read from its description's labels, and its times are never worked out", () => {
  const overview = assembleRecipe();
  assert.equal(overview.recipe?.yield, "Serves 6");
  assert.equal(overview.recipe?.totalMinutes, null);
});

test("a video's overview never keeps its whole description", () => {
  const overview = assembleRecipe();
  assert.equal("fullDescription" in overview.source, false);
});

test("a recipe the video turns out not to hold assembles nothing, so the video gets its ordinary note", () => {
  assert.equal(assembleRecipeVideoOverview(recipeInput, { ...recipeOutput, recipe: null }, meta), null);
});

test("a recipe whose every ingredient is dropped assembles nothing", () => {
  const unlisted = { ...recipeOutput.recipe!, ingredients: [] };
  assert.equal(assembleRecipeVideoOverview(recipeInput, { ...recipeOutput, recipe: unlisted }, meta), null);
});

const longInput: GenerationInput = {
  ...baseInput,
  transcript: [...baseInput.transcript, { text: Array(3000).fill("word").join(" "), startMs: 9000, endMs: 1_200_000 }],
};

test("a short video earns no big picture, whatever the model wrote", () => {
  const overview = assembleOverview(baseInput, { ...baseOutput, bigPicture: "Some ground." }, meta);

  assert.equal(overview.bigPicture, null);
});

test("a longer video keeps its big picture, trimmed, and an empty one is none", () => {
  assert.equal(assembleOverview(longInput, { ...baseOutput, bigPicture: "  Some ground.  " }, meta).bigPicture, "Some ground.");
  assert.equal(assembleOverview(longInput, { ...baseOutput, bigPicture: " " }, meta).bigPicture, null);
});

test("every step the video gives is kept in its order, a dubious one kept with its reason, each timed from the transcript", () => {
  const steps = ["one", "two", "three", "four", "five", "six"].map((text, index) => ({
    text: `Step ${text}.`,
    startSegmentIndex: index % 3,
    endSegmentIndex: index % 3,
    dubious: index === 3,
    dubiousReason: index === 3 ? " It rests on one small study. " : "",
  }));
  const overview = assembleOverview(baseInput, { ...baseOutput, sourceSteps: steps }, meta);

  assert.deepEqual(
    overview.sourceSteps?.items.map(({ text }) => text),
    ["Step one.", "Step two.", "Step three.", "Step four.", "Step five.", "Step six."],
  );
  assert.deepEqual(overview.sourceSteps?.items[1]?.range, { startMs: 2000, endMs: 8000 });
  assert.deepEqual(
    overview.sourceSteps?.items.map(({ dubiousReason }) => dubiousReason),
    [null, null, null, "It rests on one small study.", null, null],
  );
});

test("a step flagged without a reason is not dubious, and a sound step never carries one", () => {
  const overview = assembleOverview(
    baseInput,
    {
      ...baseOutput,
      sourceSteps: [
        { text: "Fast for three days.", startSegmentIndex: -1, endSegmentIndex: -1, dubious: true, dubiousReason: " " },
        { text: "Drink water.", startSegmentIndex: -1, endSegmentIndex: -1, dubious: false, dubiousReason: "Stray words." },
      ],
    },
    meta,
  );
  assert.deepEqual(
    overview.sourceSteps?.items.map(({ dubiousReason }) => dubiousReason),
    [null, null],
  );
});

test("a video that gives no steps has no steps block, not an empty one", () => {
  assert.equal(assembleOverview(baseInput, baseOutput, meta).sourceSteps, null);
  assert.equal(
    assembleOverview(
      baseInput,
      { ...baseOutput, sourceSteps: [{ text: " ", startSegmentIndex: -1, endSegmentIndex: -1, dubious: false, dubiousReason: "" }] },
      meta,
    ).sourceSteps,
    null,
  );
});

test("a step whose stretch does not fit the transcript loses its moment rather than failing the overview", () => {
  const overview = assembleOverview(
    baseInput,
    { ...baseOutput, sourceSteps: [{ text: "Breathe out.", startSegmentIndex: 1, endSegmentIndex: 9, dubious: false, dubiousReason: "" }] },
    meta,
  );
  assert.deepEqual(overview.sourceSteps?.items, [{ text: "Breathe out.", range: null, dubiousReason: null }]);
});
