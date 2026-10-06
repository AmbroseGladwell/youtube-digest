import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId, VideoId } from "@overview/domain";
import { assembleOverview } from "./assembleOverview.js";
import { generateTags } from "./generateTags.js";
import { GenerationError } from "./GenerationError.js";
import type { GenerationClient } from "./generateOverview.js";

const overview = assembleOverview(
  {
    video: {
      id: VideoId.parse("example"),
      url: "https://www.youtube.com/watch?v=example",
      title: "From Side Project to $40k a Month",
      channel: "Starter Story",
      description: null,
      durationMs: null,
      publishedAt: null,
      thumbnailUrl: null,
    },
    transcript: [{ text: "Hello.", startMs: 0, endMs: 1000 }],
    captureReason: null,
    readerContext: null,
    sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
    existingTopics: [],
    pastClaims: [],
    existingTags: [],
    tagAliases: {},
  },
  {
    inOneLine: "A founder on growing a subscription tool.",
    coreClaim: "Charging early is what made it work.",
    thin: false,
    keyPoints: [
      { text: "Raised prices twice.", range: null },
      { text: "Answers every support email.", range: null },
      { text: "Sold the company.", range: null },
    ],
    chapters: [],
    matchedTopicNames: [],
    suggestedTopic: null,
    tags: ["one-tag", "two-tag", "three-tag"],
  },
  { id: OverviewId.parse(randomUUID()), savedAt: new Date().toISOString() },
);

test("a note is re-tagged from its own words, offered the reader's tags, and spelled as the library spells them", async () => {
  const requests: Parameters<GenerationClient>[0][] = [];
  const client: GenerationClient = async (request) => {
    requests.push(request);
    return { tags: ["saas", "micro-saas", "founders"] };
  };

  const tags = await generateTags(client, {
    overview,
    existingTags: [{ tag: "founder", count: 2 }, { tag: "saas", count: 1 }],
    tagAliases: { "micro-saas": "saas" },
  });

  assert.deepEqual(tags, ["saas", "founder"]);
  assert.ok(requests[0]!.systemPrompt.includes("founder, saas"));
  assert.ok(requests[0]!.userMessage.includes("Charging early is what made it work."));
});

test("tags that fail their schema are a generation error", async () => {
  const client: GenerationClient = async () => ({ tags: ["Not A Tag"] });
  await assert.rejects(() => generateTags(client, { overview, existingTags: [], tagAliases: {} }), GenerationError);
});
