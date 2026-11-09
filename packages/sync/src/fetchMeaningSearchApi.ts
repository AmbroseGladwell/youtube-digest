import { MeaningSearchResponse } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { MeaningSearchApi } from "./MeaningSearchApi.js";

export type FetchMeaningSearchApiOptions = ApiRequesterOptions;

export function createFetchMeaningSearchApi(options: FetchMeaningSearchApiOptions): MeaningSearchApi {
  const request = createApiRequester(options);
  return {
    search: (query) =>
      answered(request("GET", `/search/meaning?query=${encodeURIComponent(query)}`, MeaningSearchResponse)),
  };
}
