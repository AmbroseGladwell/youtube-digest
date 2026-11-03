import { ArticleRead } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

export interface ArticleApi {
  read: (url: string) => Promise<ArticleRead>;
}

export function createFetchArticleApi(options: ApiRequesterOptions): ArticleApi {
  const request = createApiRequester(options);
  return {
    read: (url) => answered(request("POST", "/articles/read", ArticleRead, { body: { url } })),
  };
}
