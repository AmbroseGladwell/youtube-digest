import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, SourceKey, type SocialSource } from "@overview/domain";
import type { GenerationClient } from "../requestGeneratedOutput.js";
import { answeringKindCheck } from "../noteKind/answeringKindCheck.testHelper.js";
import { generateOverviewOf } from "../article/generateOverviewOf.js";
import { postAsVideo, type SocialGenerationInput } from "./SocialGenerationInput.js";

const reel: SocialSource = {
  kind: "instagram",
  id: SourceKey.parse("DAbCdEfGh12"),
  url: "https://www.instagram.com/reel/DAbCdEfGh12/",
  title: "Five ways to keep basil alive on a windowsill",
  handle: "windowsillgarden",
  authorName: "Windowsill Garden",
  media: "video",
  durationMs: 59_000,
  publishedAt: "2026-11-21T23:29:40.000Z",
  imageUrl: "https://scontent.cdninstagram.example/thumb.jpg",
};

const LAST_LINE = "Fifth: turn the pot a quarter each morning.";
const LONG_DESCRIPTION = `${"Water from below, never over the leaves. ".repeat(200)}${LAST_LINE}`;

test("the whole of a long description goes to the model, well past a YouTube description's length", () => {
  const video = postAsVideo(reel, LONG_DESCRIPTION);
  assert.ok(LONG_DESCRIPTION.length > 5000);
  assert.equal(video.description?.length, 400);
  assert.equal(video.fullDescription, LONG_DESCRIPTION);
  assert.equal(video.channel, "Windowsill Garden");
  assert.equal(video.id, null);
});

test("a short description is the description alone, and none is none", () => {
  assert.equal(postAsVideo(reel, "Basil tips").description, "Basil tips");
  assert.equal(postAsVideo(reel, "Basil tips").fullDescription, undefined);
  assert.equal(postAsVideo(reel, " ").description, null);
  assert.equal(postAsVideo({ ...reel, kind: "facebook", authorName: "", handle: null }, "").channel, "Facebook");
});

const inputOf = (): SocialGenerationInput => ({
  social: reel,
  video: postAsVideo(reel, LONG_DESCRIPTION),
  transcript: Array.from({ length: 12 }, (_, index) => ({
    text: `Segment ${index} says one more thing about the basil and the pot.`,
    startMs: index * 4500,
    endMs: index * 4500 + 4500,
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
  inOneLine: "Five habits that keep windowsill basil alive.",
  bigPicture: "",
  followUpQuestions: [],
  readerQuestions: [],
  coreClaim: "Watering from below is what keeps basil from rotting.",
  thin: false,
  keyPoints: [
    { text: "Water from below.", startSegmentIndex: 0, endSegmentIndex: 3 },
    { text: "Pinch the top leaves.", startSegmentIndex: 4, endSegmentIndex: 7 },
    { text: "Turn the pot daily.", startSegmentIndex: 8, endSegmentIndex: 11 },
  ],
  chapters: [],
  matchedTopicNames: [],
  suggestedTopic: null,
  tags: ["basil", "herbs", "gardening"],
  howToApply: { items: ["Move the basil to a saucer of water tonight."] },
  watchAnyway: { answer: "no", reason: "The note covers it.", startSegmentIndex: -1, endSegmentIndex: -1 },
};

test("a reel is written as a short video note from its words and whole description, and keeps its own source", async () => {
  const asked: string[] = [];
  const client: GenerationClient = async ({ systemPrompt, userMessage }) => {
    asked.push(`${systemPrompt}\n${userMessage}`);
    return answer;
  };
  const overview = await generateOverviewOf(answeringKindCheck(client), inputOf(), {
    id: OverviewId.parse(randomUUID()),
    savedAt: "2026-11-22T09:00:00.000Z",
  });
  assert.deepEqual(overview.source, reel);
  assert.equal(overview.keyPoints.length, 3);
  assert.ok(asked.some((prompt) => prompt.includes(LAST_LINE)));
});
