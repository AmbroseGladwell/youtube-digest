import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, VideoId } from "@overview/domain";
import { generateOverview, type GenerationClient } from "./generateOverview.js";
import { GenerationError, SchemaFailureError } from "./GenerationError.js";
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
  captureReason: null,
  readerContext: null,
  sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, verdict: false, selling: false, watchAnyway: false },
  existingTopics: [],
  pastClaims: [],
  existingTags: [],
  tagAliases: {},
};

const meta = { id: OverviewId.parse(randomUUID()), savedAt: new Date().toISOString() };

test("a well-formed response from the client assembles into a valid Overview", async () => {
  const client: GenerationClient = async () => ({
    inOneLine: "A short description.",
    bigPicture: "",
    coreClaim: "The core claim.",
    thin: false,
    keyPoints: [
      { text: "one", startSegmentIndex: -1, endSegmentIndex: -1 },
      { text: "two", startSegmentIndex: -1, endSegmentIndex: -1 },
      { text: "three", startSegmentIndex: -1, endSegmentIndex: -1 },
    ],
    chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
    matchedTopicNames: [],
    suggestedTopic: null,
    recipe: null,
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
      assert.ok(!userMessage.includes("Your previous attempt was"));
      return {
        inOneLine: Array(40).fill("word").join(" "),
        bigPicture: "",
        coreClaim: "The core claim.",
        thin: false,
        keyPoints: [
          { text: "one", startSegmentIndex: -1, endSegmentIndex: -1 },
          { text: "two", startSegmentIndex: -1, endSegmentIndex: -1 },
          { text: "three", startSegmentIndex: -1, endSegmentIndex: -1 },
        ],
        chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
        matchedTopicNames: [],
        suggestedTopic: null,
        recipe: null,
        tags: ["one-tag", "two-tag", "three-tag"],
        howToApply: { items: [] },
      };
    }
    assert.ok(userMessage.includes("Your previous attempt was"));
    assert.ok(userMessage.includes("inOneLine: docs/features/overview-generation-decisions.md: max 35 words"));
    return {
      inOneLine: "A short description.",
      bigPicture: "",
      coreClaim: "The core claim.",
      thin: false,
      keyPoints: [
        { text: "one", startSegmentIndex: -1, endSegmentIndex: -1 },
        { text: "two", startSegmentIndex: -1, endSegmentIndex: -1 },
        { text: "three", startSegmentIndex: -1, endSegmentIndex: -1 },
      ],
      chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
      matchedTopicNames: [],
      suggestedTopic: null,
      recipe: null,
      tags: ["one-tag", "two-tag", "three-tag"],
      howToApply: { items: [] },
    };
  };

  const overview = await generateOverview(client, input, meta);
  assert.equal(calls, 2);
  assert.equal(overview.inOneLine, "A short description.");
});

test("two consecutive schema failures surface as one SchemaFailureError, not an infinite retry", async () => {
  let calls = 0;
  const client: GenerationClient = async () => {
    calls++;
    return { nonsense: true };
  };

  await assert.rejects(() => generateOverview(client, input, meta), SchemaFailureError);
  assert.equal(calls, 2);
});

test("a key points list past the cap is sent back to be trimmed, with the attempt it came from", async () => {
  const ninePoints = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"].map((text) => ({
    text,
    startSegmentIndex: -1,
    endSegmentIndex: -1,
  }));
  let calls = 0;
  const client: GenerationClient = async ({ userMessage }) => {
    calls++;
    if (calls === 1) {
      return {
        inOneLine: "A long debate.",
        bigPicture: "",
        coreClaim: "The core claim.",
        thin: false,
        keyPoints: ninePoints,
        chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
        matchedTopicNames: [],
        suggestedTopic: null,
        recipe: null,
        tags: ["one-tag", "two-tag", "three-tag"],
        howToApply: { items: [] },
      };
    }
    assert.ok(userMessage.includes(JSON.stringify(ninePoints)));
    assert.ok(userMessage.includes("keyPoints: Too big"));
    assert.ok(userMessage.includes("keeps the ones that matter most"));
    return {
      inOneLine: "A long debate.",
      bigPicture: "",
      coreClaim: "The core claim.",
      thin: false,
      keyPoints: ninePoints.slice(0, 7),
      chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
      matchedTopicNames: [],
      suggestedTopic: null,
      recipe: null,
      tags: ["one-tag", "two-tag", "three-tag"],
      howToApply: { items: [] },
    };
  };

  const overview = await generateOverview(client, input, meta);
  assert.equal(calls, 2);
  assert.equal(overview.keyPoints.length, 7);
});

const longTranscript = Array.from({ length: 90 }, (_, index) => ({
  text: Array.from({ length: 200 }, () => "word").join(" "),
  startMs: index * 80_000,
  endMs: (index + 1) * 80_000,
}));

const answer = (keyPointsAt: number[], chapterStarts = [0]) => ({
  inOneLine: "A long interview.",
  bigPicture: "",
  coreClaim: "The core claim.",
  thin: false,
  keyPoints: keyPointsAt.map((at) => ({ text: "A point.", startSegmentIndex: at, endSegmentIndex: at + 1 })),
  chapters: chapterStarts.map((start) => ({ title: "A chapter", summary: "What it covers.", startSegmentIndex: start })),
  matchedTopicNames: [],
  suggestedTopic: null,
  recipe: null,
  tags: ["one-tag", "two-tag", "three-tag"],
  howToApply: { items: ["do this"] },
});

const answering = (...answers: unknown[]) => {
  const messages: string[] = [];
  const client: GenerationClient = async ({ userMessage }) => {
    messages.push(userMessage);
    return answers.shift();
  };
  return { client, messages };
};

test("a long video's key points that stop early go back to the model, naming where to reach", async () => {
  const { client, messages } = answering(answer([0, 10, 20]), answer([0, 30, 80]));
  const overview = await generateOverview(client, { ...input, transcript: longTranscript }, meta);
  assert.equal(messages.length, 2);
  assert.match(messages[1]!, /at least one must come from segment 60 onwards/);
  assert.equal(overview.keyPoints.length, 3);
});

test("a long video's chapter too big to skip with no key point goes back to the model, naming the segments", async () => {
  const { client, messages } = answering(answer([0, 10, 80], [0, 30, 60]), answer([0, 40, 80], [0, 30, 60]));
  await generateOverview(client, { ...input, transcript: longTranscript }, meta);
  assert.equal(messages.length, 2);
  assert.match(messages[1]!, /too much of the video to leave out: at least one key point must come from segments 30 to 59/);
});

test("a short video's key points may all come from its opening, as before", async () => {
  const shortTranscript = longTranscript.slice(0, 20);
  const { client, messages } = answering(answer([0, 1, 2]));
  await generateOverview(client, { ...input, transcript: shortTranscript }, meta);
  assert.equal(messages.length, 1);
});
