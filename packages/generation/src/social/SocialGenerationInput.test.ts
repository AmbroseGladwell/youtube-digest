import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, SourceKey, type SocialSource, type WrittenPost } from "@overview/domain";
import type { GenerationClient } from "../requestGeneratedOutput.js";
import { answeringKindCheck } from "../noteKind/answeringKindCheck.testHelper.js";
import { generateOverviewOf } from "../article/generateOverviewOf.js";
import { postAsArticle, postAsVideo, type SocialGenerationInput, type WrittenPostGenerationInput } from "./SocialGenerationInput.js";

const reel: SocialSource = {
  kind: "instagram",
  id: SourceKey.parse("DAbCdEfGh12"),
  url: "https://www.instagram.com/reel/DAbCdEfGh12/",
  title: "Five ways to keep basil alive on a windowsill",
  handle: "windowsillgarden",
  authorName: "Windowsill Garden",
  media: "video",
  wordCount: 120,
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

const photo: WrittenPost = { ...reel, media: "photo", durationMs: null, wordCount: 26 };
const RECIPE_POST =
  "Sunday basil pesto\n\n\n2 cups basil, 1/2 cup parmesan, 1/3 cup pine nuts.\n \nBlend with olive oil until smooth, then season and stir through hot pasta.";

test("a photo post becomes a one-section article of its description, its blank lines made paragraph breaks", () => {
  const article = postAsArticle(photo, RECIPE_POST);
  assert.equal(article?.siteName, "Instagram");
  assert.equal(article?.author, "Windowsill Garden");
  assert.equal(article?.wordCount, 26);
  assert.equal(article?.sections.length, 1);
  assert.equal(article?.sections[0]?.text.split("\n\n").length, 3);
  assert.equal(postAsArticle(photo, "  "), null);
});

const articleAnswer = {
  inOneLine: "A three-ingredient basil pesto for pasta.",
  bigPicture: "",
  followUpQuestions: [],
  readerQuestions: [],
  coreClaim: "Pine nuts and parmesan carry the pesto.",
  thin: false,
  keyPoints: [
    { text: "Two cups of basil.", paragraphIndex: 1 },
    { text: "Blend with olive oil.", paragraphIndex: 2 },
    { text: "Stir through hot pasta.", paragraphIndex: 2 },
  ],
  chapters: [{ title: "The pesto", summary: "What goes in.", startParagraphIndex: 0 }],
  matchedTopicNames: [],
  suggestedTopic: null,
  tags: ["pesto", "basil", "pasta"],
  howToApply: { items: [] },
  sourceSteps: [],
  readAnyway: { answer: "no", reason: "The note has it all.", leftOut: "", chapterIndexes: [] },
};

test("a photo post is written as a short article from its description, and keeps its own source", async () => {
  const input: WrittenPostGenerationInput = { ...inputOf(), social: photo, article: postAsArticle(photo, RECIPE_POST)! };
  const asked: string[] = [];
  const client: GenerationClient = async ({ userMessage }) => {
    asked.push(userMessage);
    return articleAnswer;
  };
  const overview = await generateOverviewOf(client, input, { id: OverviewId.parse(randomUUID()), savedAt: "2026-11-23T09:00:00.000Z" });
  assert.deepEqual(overview.source, photo);
  assert.equal(overview.keyPoints.length, 3);
  assert.equal(overview.article?.readAnyway?.answer, "no");
  assert.ok(asked.some((message) => message.includes("stir through hot pasta")));
});
