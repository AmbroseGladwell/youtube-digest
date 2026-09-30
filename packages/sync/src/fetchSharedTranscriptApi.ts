import { StoredTranscript } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { SharedTranscriptApi } from "./SharedTranscriptApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

export type FetchSharedTranscriptApiOptions = Omit<ApiRequesterOptions, "token">;

export function createFetchSharedTranscriptApi(options: FetchSharedTranscriptApiOptions): SharedTranscriptApi {
  const request = createApiRequester(options);
  return {
    get: (videoId) =>
      answered(request("GET", `/shared-transcripts/${encodeURIComponent(videoId)}`, StoredTranscript)).catch(
        (error: unknown) => {
          if (isSyncRequestError(error) && error.code === "not_found") return null;
          throw error;
        },
      ),
  };
}
