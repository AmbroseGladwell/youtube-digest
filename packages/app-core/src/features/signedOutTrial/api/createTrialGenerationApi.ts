import { createFetchGenerationApi, type ApiRequesterOptions, type GenerationApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

export const createTrialGenerationApi = (
  options: Omit<ApiRequesterOptions, "token" | "trialToken">,
): Pick<GenerationApi, "topicSuggestions"> => {
  return {
    topicSuggestions: (input) =>
      withTrialToken(options, (trialToken) => createFetchGenerationApi({ ...options, trialToken }).topicSuggestions(input)),
  };
};
