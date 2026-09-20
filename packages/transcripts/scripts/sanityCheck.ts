import { Supadata } from "@supadata/js";
import { fetchSupadataTranscript } from "@overview/transcripts";

const url = process.argv[2];
if (!url) {
  console.error("usage: node --env-file=.env scripts/sanityCheck.ts <youtube-url>");
  process.exit(1);
}

const client = new Supadata({ apiKey: process.env.SUPADATA_API_KEY! });

const result = await fetchSupadataTranscript(client, url);

console.log(
  JSON.stringify(
    {
      video: result.video,
      generated: result.generated,
      segmentCount: result.transcript.length,
      firstSegments: result.transcript.slice(0, 3),
      lastSegments: result.transcript.slice(-3),
    },
    null,
    2,
  ),
);
