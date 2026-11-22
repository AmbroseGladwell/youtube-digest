import { createFetchArticleApi, type ApiRequesterOptions, type ArticleApi } from "@overview/sync";
import { withTrialToken } from "./withTrialToken.js";

export const createTrialArticleApi = (options: Omit<ApiRequesterOptions, "token" | "trialToken">): ArticleApi => {
  return {
    read: (url) => withTrialToken(options, (trialToken) => createFetchArticleApi({ ...options, trialToken }).read(url)),
  };
};
