import { createFetchPodcastApi, type ApiRequesterOptions, type PodcastApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Signed out, onboarding's podcast link is read, and whether its words can be found checked, on the
// device's trial: a read counts as one of its reads, as an article's does. Finding the words and
// transcribing wait for the account, where the server refuses a trial (docs/features/onboarding.md).
export function createTrialPodcastApi(options: Omit<ApiRequesterOptions, "token" | "trialToken">): PodcastApi {
  const on = <T>(call: (api: PodcastApi) => Promise<T>) =>
    withTrialToken(options, (trialToken) => call(createFetchPodcastApi({ ...options, trialToken })));
  return {
    read: (url) => on((api) => api.read(url)),
    transcript: (ask) => on((api) => api.transcript(ask)),
    checkTranscript: (ask) => on((api) => api.checkTranscript(ask)),
    transcribe: (ask) => on((api) => api.transcribe(ask)),
    transcription: (id) => on((api) => api.transcription(id)),
  };
}
