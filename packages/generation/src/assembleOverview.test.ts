import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, TopicId, VideoId } from "@overview/domain";
import { assembleOverview } from "./assembleOverview.js";
import { GenerationError } from "./GenerationError.js";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput } from "./GeneratedOutput.js";

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
  pastClaims: [
    { overviewId: OverviewId.parse(randomUUID()), title: "An older video", claim: "Do the thing." },
  ],
};

const baseOutput: GeneratedOutput = {
  inOneLine: "A short description.",
  coreClaim: "The core claim of the video.",
  thin: false,
  keyPoints: ["one", "two", "three"],
  chapters: [{ title: "The whole thing", summary: "One stretch.", startSegmentIndex: 0 }],
  matchedTopicNames: ["fitness"],
  suggestedTopic: null,
  tags: ["one-tag", "two-tag", "three-tag"],
};

const meta = { id: OverviewId.parse(randomUUID()), savedAt: new Date().toISOString() };

test("matched topic names map to the corresponding topic ids, unmatched names are ignored", () => {
  const overview = assembleOverview(
    baseInput,
    { ...baseOutput, matchedTopicNames: ["fitness", "some-made-up-name"] },
    meta,
  );
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
      verdict: { novelty: "novel", dubious: false, reasoning: "x", similarToIndices: [] },
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
      verdict: { novelty: "recycled", dubious: false, reasoning: "x", similarToIndices: [0, 5, -1] },
    },
    meta,
  );
  assert.equal(overview.verdict?.similarTo.length, 1);
  assert.equal(overview.verdict?.similarTo[0]?.title, "An older video");
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
        range: { startSegmentIndex: 1, endSegmentIndex: 1 },
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
            range: { startSegmentIndex: 1, endSegmentIndex: 99 },
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
    () =>
      assembleOverview(
        baseInput,
        { ...baseOutput, chapters: [{ title: "x", summary: "y", startSegmentIndex: 99 }] },
        meta,
      ),
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
