import { TranscriptSearchResponse } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { TranscriptSearchApi } from "./TranscriptSearchApi.js";

export type FetchTranscriptSearchApiOptions = ApiRequesterOptions;

export const createFetchTranscriptSearchApi = (options: FetchTranscriptSearchApiOptions): TranscriptSearchApi => {
  const request = createApiRequester(options);
  return {
    search: (query) => answered(request("GET", `/search/transcripts?query=${encodeURIComponent(query)}`, TranscriptSearchResponse)),
  };
};
