import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, TopicId } from "@overview/types";
import { composePrompt } from "./composePrompt.js";
import type { GenerationInput } from "./GenerationInput.js";

const baseInput: GenerationInput = {
  video: {
    url: "https://www.youtube.com/watch?v=example",
    title: "Example",
    channel: "Example Channel",
    description: null,
    durationMs: null,
  },
  transcript: [
    { text: "Hello and welcome.", startMs: 0, endMs: 2000 },
    { text: "Here is the technique.", startMs: 2000, endMs: 8000 },
  ],
  savedNote: null,
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
  for (const structural of ["inOneLine", "coreClaim", "thin", "keyPoints", "matchedTopicNames", "tags"]) {
    assert.ok(keys.includes(structural), `expected ${structural} in schema`);
  }
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
