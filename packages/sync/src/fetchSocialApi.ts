import { PodcastTranscription, SOCIAL_READ_PATH, SOCIAL_TRANSCRIPTION_PATH, SocialRead } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

// An Instagram or Facebook post and any words, through the vendor: docs/features/social-posts.md.
export interface SocialApi {
  read: (url: string) => Promise<SocialRead>;
  // Only when the reader asks, for a video with no words (docs/features/social-posts.md).
  transcribe: (url: string) => Promise<PodcastTranscription>;
  transcription: (id: string) => Promise<PodcastTranscription>;
}

export const createFetchSocialApi = (options: ApiRequesterOptions): SocialApi => {
  const request = createApiRequester(options);
  return {
    read: (url) => answered(request("POST", SOCIAL_READ_PATH, SocialRead, { body: { url } })),
    transcribe: (url) => answered(request("POST", SOCIAL_TRANSCRIPTION_PATH, PodcastTranscription, { body: { url } })),
    transcription: (id) => answered(request("GET", `${SOCIAL_TRANSCRIPTION_PATH}/${encodeURIComponent(id)}`, PodcastTranscription)),
  };
};
