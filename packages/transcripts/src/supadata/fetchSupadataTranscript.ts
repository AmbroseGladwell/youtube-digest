import type { FetchedTranscript } from "../FetchedTranscript.js";
import {
  DEFAULT_FETCH_OPTIONS,
  fetchSupadataCaptions,
  type FetchCaptionsOptions,
} from "./fetchSupadataCaptions.js";
import { fetchSupadataVideoSource } from "./fetchSupadataVideoSource.js";
import type { SupadataClient } from "./SupadataClient.js";

// Both halves in one call, for callers that hold no transcript store to ask between them
// (docs/features/transcript-storage.md). The app is not one of those callers.
export async function fetchSupadataTranscript(
  client: SupadataClient,
  url: string,
  options: FetchCaptionsOptions = DEFAULT_FETCH_OPTIONS,
): Promise<FetchedTranscript> {
  const video = await fetchSupadataVideoSource(client, url);
  const { transcript, generated } = await fetchSupadataCaptions(client, url, options);
  return { video, transcript, generated };
}
