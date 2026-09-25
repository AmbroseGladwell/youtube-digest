import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, TopicId, VideoId } from "@overview/domain";
import { composePrompt } from "./composePrompt.js";
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
