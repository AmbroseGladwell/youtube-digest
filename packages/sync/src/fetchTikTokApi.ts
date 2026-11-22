import { TIKTOK_READ_PATH, TikTokRead } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

// The video and its words in one call, through the vendor: docs/features/tiktok-links.md.
export interface TikTokApi {
  read: (url: string) => Promise<TikTokRead>;
}

export const createFetchTikTokApi = (options: ApiRequesterOptions): TikTokApi => {
  const request = createApiRequester(options);
  return {
    read: (url) => answered(request("POST", TIKTOK_READ_PATH, TikTokRead, { body: { url } })),
  };
};
