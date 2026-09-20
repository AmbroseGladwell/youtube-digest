import type { VideoSource } from "@overview/types";
import { withSingleRetry } from "../withSingleRetry.js";
import { mapMetadataToVideoSource } from "./mapMetadataToVideoSource.js";
import type { SupadataClient } from "./SupadataClient.js";
import { asTranscriptFetchError } from "./supadataFailure.js";

// Separate from the captions call because the video id it resolves is what a caller needs
// to ask the transcript store whether the captions are already held
// (docs/features/transcript-storage.md, "Reading the cache before fetching").
export async function fetchSupadataVideoSource(
  client: SupadataClient,
  url: string,
): Promise<VideoSource> {
  try {
    const metadata = await withSingleRetry(() =>
      client.metadata({ url }).catch((error: unknown) => {
        throw asTranscriptFetchError(error);
      }),
    );
    return mapMetadataToVideoSource(metadata, url);
  } catch (error) {
    throw asTranscriptFetchError(error);
  }
}
