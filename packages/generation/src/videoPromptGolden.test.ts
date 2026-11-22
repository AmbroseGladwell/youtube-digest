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
  existingProjects: [],
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

test("a video's prompts from 1,000 words up are exactly as they were before short clips got their own rows", () => {
  assert.deepEqual(
    {
      default: fingerprint(input(100, 600_000), "default"),
      process: fingerprint(input(100, 600_000), "process"),
      recipe: fingerprint(input(100, 600_000), "recipe"),
      long: fingerprint(input(700, 4_200_000), "default"),
    },
    { default: "0b87b096187b6ef6", process: "88e10f10b8dd9622", recipe: "b93cda506bfea321", long: "2ba9cddfdda41f18" },
  );
});

test("a short clip's prompts are pinned, so they change only deliberately", () => {
  assert.deepEqual(
    {
      default: fingerprint(input(20, 120_000), "default"),
      process: fingerprint(input(20, 120_000), "process"),
      recipe: fingerprint(input(20, 120_000), "recipe"),
    },
    { default: "4c425fd87fe4c42f", process: "14213eca0428f770", recipe: "9ab04d09a8567667" },
  );
});
