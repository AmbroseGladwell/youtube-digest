import { Share, Shares } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { ShareApi } from "./ShareApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

export type FetchShareApiOptions = ApiRequesterOptions;

export const createFetchShareApi = (options: FetchShareApiOptions): ShareApi => {
  const request = createApiRequester(options);

  return {
    list: async () => (await answered(request("GET", "/shares", Shares))).shares,
    share: ({ overview, narration }) => answered(request("POST", "/shares", Share, { body: { overview, narration } })),
    // Stopping a link that's already stopped isn't an error: the reader gets what they asked for.
    stop: async (token) => {
      await request("DELETE", `/shares/${encodeURIComponent(token)}`, Share.nullable()).catch((error: unknown) => {
        if (isSyncRequestError(error) && error.code === "not_found") {
          return null;
        }
        throw error;
      });
    },
  };
};
