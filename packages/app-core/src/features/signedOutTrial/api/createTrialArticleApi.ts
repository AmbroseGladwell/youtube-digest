import { createFetchArticleApi, type ApiRequesterOptions, type ArticleApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

// Signed out, onboarding's link is read on the device's trial, which allows a few reads beside
// its one overview (docs/features/onboarding.md, "Any kind of link").
export function createTrialArticleApi(options: Omit<ApiRequesterOptions, "token" | "trialToken">): ArticleApi {
  return {
    read: (url) => withTrialToken(options, (trialToken) => createFetchArticleApi({ ...options, trialToken }).read(url)),
  };
}
