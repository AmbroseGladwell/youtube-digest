import { PodcastRead, PodcastTranscription, StoredTranscript, TranscriptCheck } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

export interface PodcastTranscriptAsk {
  feedUrl: string;
  guid: string;
  youTubeVideoId?: string;
  searchYouTube?: boolean;
}
export interface PodcastEpisodeAsk {
  feedUrl: string;
  guid: string;
}

// A podcast link read on our server, an episode's transcript from its rungs there, and an episode
// transcribed from its audio when the reader chooses (docs/features/podcast-links.md,
// docs/features/podcast-transcripts.md, docs/features/speech-to-text.md).
export interface PodcastApi {
  read: (url: string) => Promise<PodcastRead>;
  transcript: (ask: PodcastTranscriptAsk) => Promise<StoredTranscript>;
  checkTranscript: (ask: PodcastTranscriptAsk) => Promise<TranscriptCheck>;
  transcribe: (ask: PodcastEpisodeAsk) => Promise<PodcastTranscription>;
  transcription: (id: string) => Promise<PodcastTranscription>;
}

export const createFetchPodcastApi = (options: ApiRequesterOptions): PodcastApi => {
  const request = createApiRequester(options);
  return {
    read: (url) => answered(request("POST", "/podcasts/read", PodcastRead, { body: { url } })),
    transcript: (ask) => answered(request("POST", "/podcasts/transcript", StoredTranscript, { body: ask })),
    checkTranscript: (ask) => answered(request("POST", "/podcasts/transcript/check", TranscriptCheck, { body: ask })),
    transcribe: (ask) => answered(request("POST", "/podcasts/transcription", PodcastTranscription, { body: ask })),
    transcription: (id) => answered(request("GET", `/podcasts/transcription/${encodeURIComponent(id)}`, PodcastTranscription)),
  };
};
