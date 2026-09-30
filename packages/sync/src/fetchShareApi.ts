import { Share, Shares } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { ShareApi } from "./ShareApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

export type FetchShareApiOptions = ApiRequesterOptions;

export function createFetchShareApi(options: FetchShareApiOptions): ShareApi {
  const request = createApiRequester(options);

  return {
    list: async () => (await answered(request("GET", "/shares", Shares))).shares,
    share: ({ overview, transcript, narration }) =>
      answered(request("POST", "/shares", Share, { body: { overview, transcript, narration } })),
    // A link already stopped is not an error to the reader, who asked for it to be off and
    // is getting what they asked for.
    stop: async (token) => {
      await request("DELETE", `/shares/${encodeURIComponent(token)}`, Share.nullable()).catch((error: unknown) => {
        if (isSyncRequestError(error) && error.code === "not_found") return null;
        throw error;
      });
    },
  };
}
