import { randomUUID } from "node:crypto";
import { Supadata } from "@supadata/js";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_SECTIONS_ENABLED, OverviewId } from "@overview/types";
import { fetchSupadataTranscript } from "@overview/transcripts";
import { generateOverview, createAnthropicGenerationClient } from "@overview/generation";

const url = process.argv[2];
if (!url) {
  console.error("usage: node --env-file=.env scripts/endToEndSanityCheck.ts <youtube-url>");
  process.exit(1);
}

const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY! });
const fetched = await fetchSupadataTranscript(supadata, url);
console.error(
  `fetched ${fetched.transcript.length} segments (${fetched.generated ? "ASR-generated" : "native captions"}) ` +
    `for "${fetched.video.title}"`,
);

const anthropic = createAnthropicGenerationClient(new Anthropic());
const { overview, suggestedTopic } = await generateOverview(
  anthropic,
  {
    video: fetched.video,
    transcript: fetched.transcript,
    savedNote: null,
    readerContext: null,
    sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
    existingTopics: [],
    pastClaims: [],
  },
  { id: OverviewId.parse(randomUUID()), savedAt: new Date().toISOString() },
);

console.log(JSON.stringify({ overview, suggestedTopic }, null, 2));
