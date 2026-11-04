import { createFetchGenerationApi, type ApiRequesterOptions, type GenerationApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

export function createTrialGenerationApi(options: Omit<ApiRequesterOptions, "token" | "trialToken">): Pick<GenerationApi, "generate"> {
  return {
    generate: (request) =>
      withTrialToken(options, (trialToken) => createFetchGenerationApi({ ...options, trialToken }).generate(request)),
  };
}
