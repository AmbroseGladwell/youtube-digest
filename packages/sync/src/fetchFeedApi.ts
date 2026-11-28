import { FEEDS_PATH, FeedCheck, FeedRead } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

export interface FeedApi {
  lookUp: (url: string) => Promise<FeedRead>;
  check: (feedUrls: readonly string[]) => Promise<FeedCheck>;
}

// docs/features/followed-feeds.md, "The routes".
export const createFetchFeedApi = (options: ApiRequesterOptions): FeedApi => {
  const request = createApiRequester(options);
  return {
    lookUp: (url) => answered(request("POST", `${FEEDS_PATH}/lookup`, FeedRead, { body: { url } })),
    check: (feedUrls) => answered(request("POST", `${FEEDS_PATH}/check`, FeedCheck, { body: { feedUrls } })),
  };
};
