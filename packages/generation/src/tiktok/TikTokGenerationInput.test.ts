import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, SourceKey, type TikTokSource } from "@overview/domain";
import type { GenerationClient } from "../requestGeneratedOutput.js";
import { answeringKindCheck } from "../noteKind/answeringKindCheck.testHelper.js";
import { generateOverviewOf } from "../article/generateOverviewOf.js";
import { clipAsVideo, type TikTokGenerationInput } from "./TikTokGenerationInput.js";

const tiktok: TikTokSource = {
  kind: "tiktok",
  id: SourceKey.parse("7301234567890123456"),
  url: "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456",
  title: "The one-pan jollof I make every Sunday #jollof",
  handle: "kitchenwithada",
  authorName: "Kitchen with Ada",
  durationMs: 42_000,
  publishedAt: "2026-11-12T18:30:00.000Z",
  imageUrl: "https://p16-sign.tiktokcdn.example/cover.jpeg",
};

test("a long caption fits the description's 400 characters, and the whole of it goes to the model beside", () => {
  const caption = "Word ".repeat(300);
  const video = clipAsVideo(tiktok, caption);
  assert.equal(video.description?.length, 400);
  assert.equal(video.fullDescription, caption.trim());
  assert.equal(video.channel, "Kitchen with Ada");
  assert.equal(video.id, null);
});

test("a short caption is the description alone, and no caption is none", () => {
  assert.equal(clipAsVideo(tiktok, "Sunday jollof #jollof").description, "Sunday jollof #jollof");
  assert.equal(clipAsVideo(tiktok, "Sunday jollof").fullDescription, undefined);
  assert.equal(clipAsVideo(tiktok, "  ").description, null);
  assert.equal(clipAsVideo({ ...tiktok, authorName: "" }, "").channel, "@kitchenwithada");
});

const inputOf = (): TikTokGenerationInput => ({
  tiktok,
  video: clipAsVideo(tiktok, tiktok.title),
  transcript: Array.from({ length: 12 }, (_, index) => ({
    text: `Segment ${index} says one more thing about the rice and the pan.`,
    startMs: index * 3500,
    endMs: index * 3500 + 3500,
  })),
  captureReason: null,
  readerContext: null,
  sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, verdict: false, selling: false },
  existingTopics: [],
  existingProjects: [],
  pastClaims: [],
  existingTags: [],
  tagAliases: {},
});

const answer = {
  inOneLine: "A cook's one-pan jollof in under a minute.",
  bigPicture: "",
  followUpQuestions: [],
  readerQuestions: [],
  coreClaim: "Frying the base hard is what makes the rice taste smoky.",
  thin: false,
  keyPoints: [
    { text: "Fry the base until the oil floats.", startSegmentIndex: 0, endSegmentIndex: 3 },
    { text: "Wash the rice until it runs clear.", startSegmentIndex: 4, endSegmentIndex: 7 },
    { text: "Steam it covered on the lowest heat.", startSegmentIndex: 8, endSegmentIndex: 11 },
  ],
  chapters: [],
  matchedTopicNames: [],
  suggestedTopic: null,
  tags: ["jollof", "rice", "one-pan"],
  howToApply: { items: ["Fry the base longer than feels right."] },
  watchAnyway: { answer: "no", reason: "The note covers it.", startSegmentIndex: -1, endSegmentIndex: -1 },
};

test("a TikTok is written as a short video note and keeps its own source", async () => {
  const asked: string[] = [];
  const client: GenerationClient = async ({ systemPrompt }) => {
    asked.push(systemPrompt);
    return answer;
  };
  const overview = await generateOverviewOf(answeringKindCheck(client), inputOf(), {
    id: OverviewId.parse(randomUUID()),
    savedAt: "2026-11-22T09:00:00.000Z",
  });
  assert.deepEqual(overview.source, tiktok);
  assert.equal(overview.keyPoints.length, 3);
  assert.deepEqual(overview.chapters, []);
  assert.ok(asked.every((prompt) => prompt.includes("Watch it anyway")));
});
