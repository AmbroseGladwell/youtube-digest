import { createFetchPodcastApi, type ApiRequesterOptions, type PodcastApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Why finding words and transcribing wait for the account: docs/features/onboarding.md, "Any kind of link".
export const createTrialPodcastApi = (options: Omit<ApiRequesterOptions, "token" | "trialToken">): PodcastApi => {
  const on = <T>(call: (api: PodcastApi) => Promise<T>) =>
    withTrialToken(options, (trialToken) => call(createFetchPodcastApi({ ...options, trialToken })));
  return {
    read: (url) => on((api) => api.read(url)),
    readInFeed: (ask) => on((api) => api.readInFeed(ask)),
    transcript: (ask) => on((api) => api.transcript(ask)),
    checkTranscript: (ask) => on((api) => api.checkTranscript(ask)),
    transcribe: (ask) => on((api) => api.transcribe(ask)),
    transcription: (id) => on((api) => api.transcription(id)),
  };
};
