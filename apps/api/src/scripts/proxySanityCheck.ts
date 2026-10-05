import { randomUUID } from "node:crypto";
import { fetchInnerTubeTranscript, TranscriptFetchError, type YouTubeFetch } from "@overview/transcripts";
import { proxiedYouTubeFetch, undiciYouTubeFetch } from "../transcripts/undiciYouTubeFetch.js";

// The one check no fixture can be: a real video through the real proxy, from this machine,
// printing the bytes each fetch carried so the cost per transcript is measured rather than
// assumed (docs/architecture/server-side-transcripts.md, "Checking it by hand").
const url = process.argv[2];
const proxyUrl = process.env.TRANSCRIPT_PROXY_URL;
if (!url || !proxyUrl) {
  console.error("usage: TRANSCRIPT_PROXY_URL=... node apps/api/dist/scripts/proxySanityCheck.js <youtube-url> [--direct]");
  process.exit(1);
}
const videoId = new URL(url).searchParams.get("v") ?? new URL(url).pathname.slice(1);
const direct = process.argv.includes("--direct");
const session = randomUUID().replaceAll("-", "").slice(0, 16);
const proxied = direct ? null : proxiedYouTubeFetch(proxyUrl)(session);
const inner = proxied?.youTubeFetch ?? undiciYouTubeFetch();

let bytes = 0;
const youTubeFetch: YouTubeFetch = async (request) => {
  const response = await inner(request);
  const carried = Buffer.byteLength(request.body ?? "") + Buffer.byteLength(response.body);
  bytes += carried;
  console.error(`  ${request.method} ${new URL(request.url).pathname} -> ${response.status}, ${carried}B`);
  return response;
};

console.error(direct ? "route: direct from this machine" : `route: proxy ${new URL(proxyUrl).host}, session ${session}`);
const startedAt = Date.now();
try {
  const result = await fetchInnerTubeTranscript(youTubeFetch, videoId, url);
  console.log(
    JSON.stringify(
      {
        title: result.video.title,
        generated: result.generated,
        segmentCount: result.transcript.length,
        bytesOverTheWire: bytes,
        ms: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (!(error instanceof TranscriptFetchError)) throw error;
  console.error(`\n${error.failure}: ${error.message} (${bytes}B, ${Date.now() - startedAt}ms)`);
  process.exitCode = 2;
} finally {
  await proxied?.close();
}
