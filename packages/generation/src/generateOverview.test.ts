import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, VideoId } from "@overview/domain";
import { generateOverview, type GenerationClient } from "./generateOverview.js";
import { GenerationError } from "./GenerationError.js";
import type { GenerationInput } from "./GenerationInput.js";

const input: GenerationInput = {
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
  transcript: [{ text: "Hello.", startMs: 0, endMs: 1000 }],
  savedNote: null,
  readerContext: null,
  sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, verdict: false, selling: false, watchAnyway: false },
  existingTopics: [],
  pastClaims: [],
};

const meta = { id: OverviewId.parse(randomUUID()), savedAt: new Date().toISOString() };

test("a well-formed response from the client assembles into a valid Overview", async () => {
  const client: GenerationClient = async () => ({
    inOneLine: "A short description.",
    coreClaim: "The core claim.",
    thin: false,
    keyPoints: ["one", "two", "three"],
    matchedTopicNames: [],
    suggestedTopic: null,
    tags: ["one-tag", "two-tag", "three-tag"],
    howToApply: { items: ["do this"] },
  });

  const overview = await generateOverview(client, input, meta);
  assert.equal(overview.id, meta.id);
  assert.equal(overview.howToApply?.items[0], "do this");
});

test("a response that doesn't match the composed schema is a GenerationError, not a crash deep in assembly", async () => {
  const client: GenerationClient = async () => ({ nonsense: true });

  await assert.rejects(() => generateOverview(client, input, meta), GenerationError);
});

test("a first attempt that violates a refinement (not just the JSON shape) gets one retry naming the violation", async () => {
  let calls = 0;
  const client: GenerationClient = async ({ userMessage }) => {
    calls++;
    if (calls === 1) {
      assert.ok(!userMessage.includes("Your previous attempt violated"));
      return {
        inOneLine: Array(30).fill("word").join(" "),
        coreClaim: "The core claim.",
        thin: false,
        keyPoints: ["one", "two", "three"],
        matchedTopicNames: [],
        suggestedTopic: null,
        tags: ["one-tag", "two-tag", "three-tag"],
        howToApply: { items: [] },
      };
    }
    assert.ok(userMessage.includes("Your previous attempt violated"));
    assert.ok(userMessage.includes("inOneLine"));
    return {
      inOneLine: "A short description.",
      coreClaim: "The core claim.",
      thin: false,
      keyPoints: ["one", "two", "three"],
      matchedTopicNames: [],
      suggestedTopic: null,
      tags: ["one-tag", "two-tag", "three-tag"],
      howToApply: { items: [] },
    };
  };

  const overview = await generateOverview(client, input, meta);
  assert.equal(calls, 2);
  assert.equal(overview.inOneLine, "A short description.");
});

test("two consecutive schema failures surface as one GenerationError, not an infinite retry", async () => {
  let calls = 0;
  const client: GenerationClient = async () => {
    calls++;
    return { nonsense: true };
  };

  await assert.rejects(() => generateOverview(client, input, meta), GenerationError);
  assert.equal(calls, 2);
});
