import type { VideoSource } from "@overview/types";
import type { TranscriptSourceClient } from "./TranscriptSourceClient.js";
import { mapMetadataToVideoSource } from "./mapMetadataToVideoSource.js";
import { withSingleRetry } from "./withSingleRetry.js";

// Separate from the captions call because the video id it resolves is what a caller needs
// to ask the transcript store whether the captions are already held
// (docs/features/transcript-storage.md, "Reading the cache before fetching").
export async function fetchVideoSource(
  client: TranscriptSourceClient,
  url: string,
): Promise<VideoSource> {
  const metadata = await withSingleRetry(() => client.metadata({ url }));
  return mapMetadataToVideoSource(metadata, url);
}
