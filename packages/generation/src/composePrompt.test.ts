import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DEFAULT_SECTIONS_ENABLED, TopicId, VideoId } from "@overview/domain";
import { composePrompt } from "./composePrompt.js";
import { KEY_POINT_MAX_WORDS, KEY_POINT_TARGET_WORDS } from "./sections/coreSection.js";
import { HOW_TO_APPLY_MAX_WORDS, HOW_TO_APPLY_TARGET_WORDS } from "./sections/howToApplySection.js";
import type { GenerationInput } from "./GenerationInput.js";

const baseInput: GenerationInput = {
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
  transcript: [
    { text: "Hello and welcome.", startMs: 0, endMs: 2000 },
    { text: "Here is the technique.", startMs: 2000, endMs: 8000 },
  ],
  captureReason: null,
  readerContext: null,
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  existingTopics: [],
  pastClaims: [],
};

test("structural fields are always in the schema, regardless of toggles", () => {
  const { schema } = composePrompt({
    ...baseInput,
    sectionsEnabled: { verdict: false, selling: false, howToApply: false, watchAnyway: false },
  });
  const keys = Object.keys(schema.shape);
  for (const structural of ["inOneLine", "coreClaim", "thin", "keyPoints", "chapters", "matchedTopicNames", "tags"]) {
    assert.ok(keys.includes(structural), `expected ${structural} in schema`);
  }
});

test("the em dash ban is always in the prompt, regardless of which sections are toggled", () => {
  const { systemPrompt } = composePrompt({
    ...baseInput,
    sectionsEnabled: { verdict: false, selling: false, howToApply: false, watchAnyway: false },
  });
  assert.ok(systemPrompt.includes("Never use an em dash"));
});

test("a disabled section removes its field from the schema entirely, not just from the prompt", () => {
  const { schema } = composePrompt({
    ...baseInput,
    sectionsEnabled: { verdict: false, selling: true, howToApply: false, watchAnyway: false },
  });
  const keys = Object.keys(schema.shape);
  assert.ok(!keys.includes("verdict"));
  assert.ok(!keys.includes("howToApply"));
  assert.ok(!keys.includes("watchAnyway"));
  assert.ok(keys.includes("selling"));
});

test("turning selling off also removes verdict's conflict-of-interest clause from the prompt", () => {
  const withSelling = composePrompt({
    ...baseInput,
    sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, selling: true, verdict: true },
  });
  const withoutSelling = composePrompt({
    ...baseInput,
    sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, selling: false, verdict: true },
  });
  assert.ok(withSelling.systemPrompt.includes("conveniently requires"));
  assert.ok(!withoutSelling.systemPrompt.includes("conveniently requires"));
});

test("the topic-match field is constrained to the reader's own topic names", () => {
  const fitnessId = randomUUID();
  const { schema } = composePrompt({
    ...baseInput,
    existingTopics: [
      {
        id: TopicId.parse(fitnessId),
        name: "fitness",
        description: null,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  const picked = schema.pick({ matchedTopicNames: true });
  assert.doesNotThrow(() => picked.parse({ matchedTopicNames: ["fitness"] }));
  assert.throws(() => picked.parse({ matchedTopicNames: ["not-a-real-topic"] }));
});

test("with no existing topics, the match field can only ever come back empty", () => {
  const { schema } = composePrompt(baseInput);
  const picked = schema.pick({ matchedTopicNames: true });
  assert.doesNotThrow(() => picked.parse({ matchedTopicNames: [] }));
  assert.throws(() => picked.parse({ matchedTopicNames: ["anything"] }));
});

test("watch-it-anyway's range is a segment-index pair, never a raw timestamp the model would have to invent", () => {
  const { schema } = composePrompt({
    ...baseInput,
    sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, watchAnyway: true },
  });
  const picked = schema.pick({ watchAnyway: true });
  assert.doesNotThrow(() =>
    picked.parse({
      watchAnyway: { answer: "partial", reason: "x", range: { startSegmentIndex: 0, endSegmentIndex: 1 } },
    }),
  );
  assert.throws(() =>
    picked.parse({
      watchAnyway: { answer: "partial", reason: "x", range: { startMs: 0, endMs: 1000 } },
    }),
  );
});

test("with an empty transcript, watch-it-anyway's range can only be null", () => {
  const { schema } = composePrompt({
    ...baseInput,
    transcript: [],
    sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, watchAnyway: true },
  });
  const picked = schema.pick({ watchAnyway: true });
  assert.doesNotThrow(() =>
    picked.parse({ watchAnyway: { answer: "no", reason: "x", range: null } }),
  );
  assert.throws(() =>
    picked.parse({
      watchAnyway: { answer: "partial", reason: "x", range: { startSegmentIndex: 0, endSegmentIndex: 0 } },
    }),
  );
});

const chapterAt = (startSegmentIndex: number) => ({
  title: "A chapter",
  summary: "What it covers.",
  startSegmentIndex,
});

test("a chapter names where it starts as a segment index, never a time the model would have to invent", () => {
  const picked = composePrompt(baseInput).schema.pick({ chapters: true });
  assert.doesNotThrow(() => picked.parse({ chapters: [chapterAt(0), chapterAt(1)] }));
  assert.throws(() =>
    picked.parse({ chapters: [{ title: "A chapter", summary: "What it covers.", startMs: 0 }] }),
  );
});

test("the first chapter starts at segment 0 and each one starts after the one before it", () => {
  const picked = composePrompt(baseInput).schema.pick({ chapters: true });
  assert.throws(() => picked.parse({ chapters: [chapterAt(1)] }));
  assert.throws(() => picked.parse({ chapters: [chapterAt(0), chapterAt(0)] }));
  assert.throws(() => picked.parse({ chapters: [chapterAt(1), chapterAt(0)] }));
});

test("a chapter cannot start past the last segment, and there is always at least one", () => {
  const picked = composePrompt(baseInput).schema.pick({ chapters: true });
  assert.throws(() => picked.parse({ chapters: [chapterAt(0), chapterAt(2)] }));
  assert.throws(() => picked.parse({ chapters: [] }));
});

test("with an empty transcript, the chapter list can only be empty", () => {
  const picked = composePrompt({ ...baseInput, transcript: [] }).schema.pick({ chapters: true });
  assert.doesNotThrow(() => picked.parse({ chapters: [] }));
  assert.throws(() => picked.parse({ chapters: [chapterAt(0)] }));
});

test("the reader's reason for saving the video reaches the prompt in their own words", () => {
  const { userMessage } = composePrompt({
    ...baseInput,
    captureReason: "Why do mammals get a billion heartbeats?",
  });

  assert.match(userMessage, /Why they saved it: Why do mammals get a billion heartbeats\?/);
});

test("a video saved without a reason says so, rather than leaving the line blank", () => {
  const { userMessage } = composePrompt(baseInput);

  assert.match(userMessage, /Why they saved it: not said/);
});

test("asks for fields that read well aloud, whichever sections are on", () => {
  const { systemPrompt } = composePrompt({
    ...baseInput,
    sectionsEnabled: { verdict: false, selling: false, howToApply: false, watchAnyway: false },
  });
  assert.ok(systemPrompt.includes("write for the ear as well as the eye"));
  assert.ok(systemPrompt.includes("Keep numbers, money and symbols as digits and symbols"));
});

test("asks for key points and actions as complete sentences that follow the ordering words", () => {
  const { systemPrompt } = composePrompt(baseInput);
  assert.ok(systemPrompt.includes(`one to three complete sentences, ${KEY_POINT_TARGET_WORDS} words at most`));
  assert.ok(systemPrompt.includes(`one complete sentence, ${HOW_TO_APPLY_TARGET_WORDS} words at most`));
  assert.ok(systemPrompt.includes(`"First,", "Then," or "And finally,"`));
});

test("asks the key points to keep the specifics and any caveat the video raises", () => {
  const { systemPrompt } = composePrompt(baseInput);
  assert.ok(systemPrompt.includes("names, numbers,\ndates, studies"));
  assert.ok(systemPrompt.includes("Always keep any caveat,\ncriticism or counter-argument"));
});

test("keeps the verdict reasoning off its own label and the watch reason off the answer", () => {
  const { systemPrompt } = composePrompt(baseInput);
  assert.ok(systemPrompt.includes("Never begin the reasoning with\nthe novelty word itself"));
  assert.ok(systemPrompt.includes("never restate yes, no, or skip in it"));
});

test("asks for each dubious claim's moment as a transcript segment, never a time", () => {
  const { systemPrompt, schema } = composePrompt(baseInput);
  const verdict = schema.shape.verdict as z.ZodObject;
  const dubiousClaim = { claim: "A claim.", basis: "contradictsSettled", reason: "A reason.", segmentIndex: 0 };

  assert.ok(systemPrompt.includes("Never estimate a time: the segment number is the position."));
  assert.equal(z.safeParse(verdict.shape.dubiousClaims!, [dubiousClaim]).success, true);
  assert.equal(z.safeParse(verdict.shape.dubiousClaims!, [{ ...dubiousClaim, segmentIndex: 999 }]).success, false);
});

test("names at most three dubious claims", () => {
  const { schema } = composePrompt(baseInput);
  const verdict = schema.shape.verdict as z.ZodObject;
  const dubiousClaim = { claim: "A claim.", basis: "conflictOfInterest", reason: "A reason.", segmentIndex: 0 };

  assert.equal(z.safeParse(verdict.shape.dubiousClaims!, Array(3).fill(dubiousClaim)).success, true);
  assert.equal(z.safeParse(verdict.shape.dubiousClaims!, Array(4).fill(dubiousClaim)).success, false);
});

test("asks for fewer words than it enforces, so a near miss does not fail the overview", () => {
  const { schema } = composePrompt(baseInput);
  const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");
  const accepts = (field: string, value: unknown) => z.safeParse(schema.shape[field]!, value).success;

  assert.ok(KEY_POINT_TARGET_WORDS < KEY_POINT_MAX_WORDS);
  assert.ok(HOW_TO_APPLY_TARGET_WORDS < HOW_TO_APPLY_MAX_WORDS);
  assert.equal(accepts("keyPoints", [words(KEY_POINT_TARGET_WORDS + 1), "Two.", "Three."]), true);
  assert.equal(accepts("howToApply", { items: [words(HOW_TO_APPLY_TARGET_WORDS + 1)] }), true);
});

test("refuses a key point or an action over its hard word ceiling, so the retry shortens it", () => {
  const { schema } = composePrompt(baseInput);
  const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");
  const accepts = (field: string, value: unknown) => z.safeParse(schema.shape[field]!, value).success;

  assert.equal(accepts("keyPoints", [words(KEY_POINT_MAX_WORDS), "Two.", "Three."]), true);
  assert.equal(accepts("keyPoints", [words(KEY_POINT_MAX_WORDS + 1), "Two.", "Three."]), false);
  assert.equal(accepts("howToApply", { items: [words(HOW_TO_APPLY_MAX_WORDS)] }), true);
  assert.equal(accepts("howToApply", { items: [words(HOW_TO_APPLY_MAX_WORDS + 1)] }), false);
});
