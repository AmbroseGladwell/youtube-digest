import { createFetchTikTokApi, type ApiRequesterOptions, type TikTokApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Transcribing needs an account, so the trial's calls for it are answered as signed out.
export const createTrialTikTokApi = (options: Omit<ApiRequesterOptions, "token" | "trialToken">): TikTokApi => ({
  read: (url) => withTrialToken(options, (trialToken) => createFetchTikTokApi({ ...options, trialToken }).read(url)),
  transcribe: (url) => createFetchTikTokApi(options).transcribe(url),
  transcription: (id) => createFetchTikTokApi(options).transcription(id),
});
