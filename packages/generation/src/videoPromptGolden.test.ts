import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, VideoId, type NoteKind } from "@overview/domain";
import { composePrompt } from "./composePrompt.js";
import { providerJsonSchema } from "./providerJsonSchema.js";
import type { GenerationInput } from "./GenerationInput.js";

const transcript = (segments: number) =>
  Array.from({ length: segments }, (_, index) => ({
    text: `Segment ${index} explains one more part of the technique in ordinary words.`,
    startMs: index * 6000,
    endMs: index * 6000 + 6000,
  }));

const input = (segments: number, durationMs: number | null): GenerationInput => ({
  video: {
    id: VideoId.parse("example"),
    url: "https://www.youtube.com/watch?v=example",
    title: "Example",
    channel: "Example Channel",
    description: "A description.",
    durationMs,
    publishedAt: null,
    thumbnailUrl: null,
  },
  transcript: transcript(segments),
  captureReason: "to learn it",
  readerContext: null,
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  existingTopics: [],
  pastClaims: [],
  existingTags: [],
  tagAliases: {},
});

const fingerprint = (value: GenerationInput, kind: NoteKind) => {
  const { systemPrompt, userMessage, schema } = composePrompt(value, kind);
  return createHash("sha256")
    .update(JSON.stringify([systemPrompt, userMessage, providerJsonSchema(schema)]))
    .digest("hex")
    .slice(0, 16);
};

// The video prompts byte for byte as they stood before podcasts forked them, so a podcast's
// wording can never leak into a video's note (docs/features/podcast-notes.md, "Videos unchanged").
// A deliberate change to the video prompt updates these, in a PR that says so.
test("the video prompts are exactly as they were", () => {
  assert.deepEqual(
    {
      short: fingerprint(input(20, 120_000), "default"),
      process: fingerprint(input(20, 120_000), "process"),
      recipe: fingerprint(input(20, 120_000), "recipe"),
      long: fingerprint(input(700, 4_200_000), "default"),
    },
    { short: "1555dd43c0e59285", process: "50a707ad02dcde79", recipe: "52fc793b9b8bc3f1", long: "a2ef2404c40bc8b4" },
  );
});
