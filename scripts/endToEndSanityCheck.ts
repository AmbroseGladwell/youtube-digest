import { randomUUID } from "node:crypto";
import { Supadata } from "@supadata/js";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_SECTIONS_ENABLED, OverviewId } from "@overview/domain";
import {
  fetchInnerTubeTranscript,
  fetchSupadataTranscript,
  isWorthAnotherSource,
  TranscriptFetchError,
  type FetchedTranscript,
  type YouTubeFetch,
} from "@overview/transcripts";
import { generateOverview, createAnthropicGenerationClient } from "@overview/generation";

const url = process.argv[2];
if (!url) {
  console.error("usage: task secrets:run -- npx tsx scripts/endToEndSanityCheck.ts <youtube-url>");
  process.exit(1);
}

function videoIdOf(videoUrl: string): string {
  const parsed = new URL(videoUrl);
  const id = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
  if (!id) throw new Error(`no video id in ${videoUrl}`);
  return id;
}

const nodeFetch: YouTubeFetch = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  return { status: response.status, body: await response.text() };
};

// The same rungs in the same order as the app: the free source first, Supadata only
// when there is a key and the free source's failure says nothing about the video.
async function fetchTranscript(videoUrl: string): Promise<FetchedTranscript> {
  try {
    return await fetchInnerTubeTranscript(nodeFetch, videoIdOf(videoUrl), videoUrl);
  } catch (error) {
    const apiKey = process.env.SUPADATA_API_KEY;
    const worthAsking =
      error instanceof TranscriptFetchError && isWorthAnotherSource(error.failure) && apiKey;
    if (!worthAsking) throw error;
    console.error(`InnerTube failed (${error.failure}): ${error.message}; asking Supadata`);
    return fetchSupadataTranscript(new Supadata({ apiKey }), videoUrl);
  }
}

const fetched = await fetchTranscript(url);
console.error(
  `fetched ${fetched.transcript.length} segments (${fetched.generated ? "ASR-generated" : "native captions"}) ` +
    `for "${fetched.video.title}"`,
);

const overview = await generateOverview(
  createAnthropicGenerationClient(new Anthropic()),
  {
    video: fetched.video,
    transcript: fetched.transcript,
    captureReason: null,
    readerContext: null,
    sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
    existingTopics: [],
    pastClaims: [],
  },
  { id: OverviewId.parse(randomUUID()), savedAt: new Date().toISOString() },
);

console.log(JSON.stringify(overview, null, 2));
