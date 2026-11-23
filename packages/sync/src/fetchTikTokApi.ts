import { PodcastTranscription, TIKTOK_READ_PATH, TIKTOK_TRANSCRIPTION_PATH, TikTokRead } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

// The video and its words in one call, through the vendor: docs/features/tiktok-links.md.
export interface TikTokApi {
  read: (url: string) => Promise<TikTokRead>;
  // Only when the reader asks, for a TikTok with no captions (docs/features/tiktok-links.md).
  transcribe: (url: string) => Promise<PodcastTranscription>;
  transcription: (id: string) => Promise<PodcastTranscription>;
}

export const createFetchTikTokApi = (options: ApiRequesterOptions): TikTokApi => {
  const request = createApiRequester(options);
  return {
    read: (url) => answered(request("POST", TIKTOK_READ_PATH, TikTokRead, { body: { url } })),
    transcribe: (url) => answered(request("POST", TIKTOK_TRANSCRIPTION_PATH, PodcastTranscription, { body: { url } })),
    transcription: (id) => answered(request("GET", `${TIKTOK_TRANSCRIPTION_PATH}/${encodeURIComponent(id)}`, PodcastTranscription)),
  };
};
