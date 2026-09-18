import type { TranscriptSourceClient } from "./TranscriptSourceClient.js";
import type { FetchedTranscript } from "./FetchedTranscript.js";
import {
  DEFAULT_FETCH_OPTIONS,
  fetchTranscriptContent,
  type FetchTranscriptOptions,
} from "./fetchTranscriptContent.js";
import { fetchVideoSource } from "./fetchVideoSource.js";

export async function fetchTranscript(
  client: TranscriptSourceClient,
  url: string,
  options: FetchTranscriptOptions = DEFAULT_FETCH_OPTIONS,
): Promise<FetchedTranscript> {
  const video = await fetchVideoSource(client, url);
  const { transcript, generated } = await fetchTranscriptContent(client, url, options);
  return { video, transcript, generated };
}
