import { PodcastRead, StoredTranscript } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

export type PodcastTranscriptAsk = { feedUrl: string; guid: string; youTubeVideoId?: string; searchYouTube?: boolean };

// A podcast link read on our server, and an episode's transcript from its rungs there
// (docs/features/podcast-links.md, docs/features/podcast-transcripts.md).
export interface PodcastApi {
  read: (url: string) => Promise<PodcastRead>;
  transcript: (ask: PodcastTranscriptAsk) => Promise<StoredTranscript>;
}

export function createFetchPodcastApi(options: ApiRequesterOptions): PodcastApi {
  const request = createApiRequester(options);
  return {
    read: (url) => answered(request("POST", "/podcasts/read", PodcastRead, { body: { url } })),
    transcript: (ask) => answered(request("POST", "/podcasts/transcript", StoredTranscript, { body: ask })),
  };
}
