import { createFetchSocialApi, type ApiRequesterOptions, type SocialApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Transcribing needs an account, so the trial's calls for it are answered as signed out.
export const createTrialSocialApi = (options: Omit<ApiRequesterOptions, "token" | "trialToken">): SocialApi => ({
  read: (url) => withTrialToken(options, (trialToken) => createFetchSocialApi({ ...options, trialToken }).read(url)),
  transcribe: (url) => createFetchSocialApi(options).transcribe(url),
  transcription: (id) => createFetchSocialApi(options).transcription(id),
});
