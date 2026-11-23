import { createFetchTikTokApi, type ApiRequesterOptions, type TikTokApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

export const createTrialTikTokApi = (options: Omit<ApiRequesterOptions, "token" | "trialToken">): TikTokApi => ({
  read: (url) => withTrialToken(options, (trialToken) => createFetchTikTokApi({ ...options, trialToken }).read(url)),
});
