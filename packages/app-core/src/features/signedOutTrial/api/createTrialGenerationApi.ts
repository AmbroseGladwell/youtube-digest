import { createFetchGenerationApi, type ApiRequesterOptions, type GenerationApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Signed out, the one model call before an account: onboarding's topic suggestions (OV-327).
export const createTrialGenerationApi = (
  options: Omit<ApiRequesterOptions, "token" | "trialToken">,
): Pick<GenerationApi, "topicSuggestions"> => {
  return {
    topicSuggestions: (input) =>
      withTrialToken(options, (trialToken) => createFetchGenerationApi({ ...options, trialToken }).topicSuggestions(input)),
  };
};
