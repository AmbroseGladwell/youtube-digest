import { createFetchPodcastApi, type ApiRequesterOptions, type PodcastApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Signed out, onboarding's podcast link is read, and the episode's words found, on the device's
// trial: a read counts as one of its reads, as an article's does (docs/features/onboarding.md).
export function createTrialPodcastApi(options: Omit<ApiRequesterOptions, "token" | "trialToken">): PodcastApi {
  return {
    read: (url) => withTrialToken(options, (trialToken) => createFetchPodcastApi({ ...options, trialToken }).read(url)),
    transcript: (ask) => withTrialToken(options, (trialToken) => createFetchPodcastApi({ ...options, trialToken }).transcript(ask)),
  };
}
