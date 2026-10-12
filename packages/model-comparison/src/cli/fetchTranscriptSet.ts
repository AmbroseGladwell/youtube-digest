import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fetchInnerTubeTranscript, withSingleRetry, type YouTubeFetch } from "@overview/transcripts";
import { comparisonPaths } from "../comparisonPaths.js";
import { TRANSCRIPT_SET } from "../transcriptSet.js";

const nodeFetch: YouTubeFetch = async (request) => {
  const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body ?? null });
  return { status: response.status, body: await response.text() };
};

const videoIdOf = (url: string) => {
  const parsed = new URL(url);
  const id = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
  if (!id) throw new Error(`no video id in ${url}`);
  return id;
};

await mkdir(comparisonPaths.transcripts, { recursive: true });
let failures = 0;
for (const { url, chosenFor } of TRANSCRIPT_SET) {
  const videoId = videoIdOf(url);
  const path = join(comparisonPaths.transcripts, `${videoId}.json`);
  if (await access(path).then(() => true, () => false)) {
    console.error(`have    ${videoId}  ${chosenFor}`);
    continue;
  }
  try {
    const fetched = await withSingleRetry(() => fetchInnerTubeTranscript(nodeFetch, videoId, url));
    await writeFile(path, `${JSON.stringify(fetched)}\n`);
    console.error(
      `fetched ${videoId}  ${fetched.transcript.length} segments, ` +
        `${fetched.generated ? "auto-captions" : "creator captions"}: ${fetched.video.title}`,
    );
  } catch (error) {
    failures += 1;
    console.error(`FAILED  ${videoId}  ${chosenFor}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.error(`\n${TRANSCRIPT_SET.length - failures} of ${TRANSCRIPT_SET.length} transcripts in ${comparisonPaths.transcripts}`);
process.exit(failures === 0 ? 0 : 1);
