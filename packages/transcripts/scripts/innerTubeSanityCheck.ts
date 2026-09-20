import {
  DEFAULT_CAPTION_CLIENTS,
  fetchInnerTubeTranscript,
  TranscriptFetchError,
  type YouTubeFetch,
} from "@overview/transcripts";

// No key and no .env: the point of this path is that it costs nothing. What it proves,
// and what no fixture can, is that the client versions in InnerTubeClientConfig still
// work against the real endpoint (docs/features/transcript-retrieval.md).
const url = process.argv[2];
if (!url) {
  console.error("usage: node packages/transcripts/scripts/innerTubeSanityCheck.ts <youtube-url>");
  process.exit(1);
}

const videoId = new URL(url).searchParams.get("v") ?? new URL(url).pathname.slice(1);
if (!videoId) {
  console.error(`could not read a video id out of ${url}`);
  process.exit(1);
}

let bytes = 0;
const youTubeFetch: YouTubeFetch = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  const body = await response.text();
  bytes += Buffer.byteLength(body);
  console.error(
    `  ${request.method} ${new URL(request.url).pathname} -> ${response.status}, ${Buffer.byteLength(body)}B`,
  );
  return { status: response.status, body };
};

console.error(`clients: ${DEFAULT_CAPTION_CLIENTS.map((c) => `${c.clientName}/${c.clientVersion}`).join(", ")}`);

// A named failure is an answer, not a crash: "no captions" and "removed by the uploader"
// are things this script exists to be able to report.
const result = await fetchInnerTubeTranscript(youTubeFetch, videoId, url, {}).catch(
  (error: unknown) => {
    if (error instanceof TranscriptFetchError) {
      console.error(`\n${error.failure}: ${error.message}`);
      process.exit(2);
    }
    throw error;
  },
);
const last = result.transcript.at(-1);

console.log(
  JSON.stringify(
    {
      video: result.video,
      generated: result.generated,
      segmentCount: result.transcript.length,
      firstSegments: result.transcript.slice(0, 3),
      lastSegments: result.transcript.slice(-2),
      // Printed together because they are different measurements of the same video, and
      // the gap between them is the reason durationMs is not taken from the captions.
      durationMs: result.video.durationMs,
      lastCaptionEndsMs: last?.endMs ?? null,
      bytesOverTheWire: bytes,
    },
    null,
    2,
  ),
);
