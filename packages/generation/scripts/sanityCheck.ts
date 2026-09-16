import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_SECTIONS_ENABLED, OverviewId } from "@digest/types";
import {
  generateOverview,
  createAnthropicGenerationClient,
  type GenerationInput,
  type TranscriptSegment,
} from "@digest/generation";
import { randomUUID } from "node:crypto";

const transcriptPath = process.argv[2];
if (!transcriptPath) {
  console.error("usage: node --env-file=.env scripts/sanityCheck.ts <transcript.json>");
  process.exit(1);
}

const transcript: TranscriptSegment[] = JSON.parse(readFileSync(transcriptPath, "utf-8"));

const rawDescription =
  "The hidden math that governs life. Sponsored by Brilliant - Try Brilliant for free, plus get " +
  "20% off an annual Premium subscription at https://brilliant.org/veritasium";

const input: GenerationInput = {
  video: {
    url: "https://youtube.com/watch?v=tL9Lw250spc",
    title: "Why does every mammal get 1 billion heartbeats in their life?",
    channel: "Veritasium",
    description: rawDescription.slice(0, 400),
    durationMs: transcript.at(-1)?.endMs ?? null,
  },
  transcript,
  savedNote: "Why do mammals get 1 billion heart beats?",
  readerContext: null,
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  existingTopics: [],
  pastClaims: [],
};

const client = createAnthropicGenerationClient(new Anthropic());

const { overview, suggestedTopic } = await generateOverview(client, input, {
  id: OverviewId.parse(randomUUID()),
  savedAt: new Date().toISOString(),
});

console.log(JSON.stringify({ overview, suggestedTopic }, null, 2));
