import { createFetchVideoApi, type ApiRequesterOptions, type VideoApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

export const createTrialVideoApi = (options: Omit<ApiRequesterOptions, "token" | "trialToken">): VideoApi => {
  return {
    read: (videoId) => withTrialToken(options, (trialToken) => createFetchVideoApi({ ...options, trialToken }).read(videoId)),
  };
};
