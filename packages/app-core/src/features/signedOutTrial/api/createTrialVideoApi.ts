import { createFetchVideoApi, type ApiRequesterOptions, type VideoApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Signed out, onboarding's video is read on the device's trial, as a page or an episode is
// (docs/features/onboarding.md, "Any kind of link").
export function createTrialVideoApi(options: Omit<ApiRequesterOptions, "token" | "trialToken">): VideoApi {
  return {
    read: (videoId) => withTrialToken(options, (trialToken) => createFetchVideoApi({ ...options, trialToken }).read(videoId)),
  };
}
