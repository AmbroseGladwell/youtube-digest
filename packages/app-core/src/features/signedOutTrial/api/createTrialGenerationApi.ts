import { createFetchGenerationApi, type ApiRequesterOptions, type GenerationApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

export function createTrialGenerationApi(
  options: Omit<ApiRequesterOptions, "token" | "trialToken">,
): Pick<GenerationApi, "generate" | "topicSuggestions"> {
  return {
    generate: (request) =>
      withTrialToken(options, (trialToken) => createFetchGenerationApi({ ...options, trialToken }).generate(request)),
    topicSuggestions: (input) =>
      withTrialToken(options, (trialToken) => createFetchGenerationApi({ ...options, trialToken }).topicSuggestions(input)),
  };
}
