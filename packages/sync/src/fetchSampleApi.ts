import { Samples, SharedOverview } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { SampleApi } from "./SampleApi.js";

export type FetchSampleApiOptions = ApiRequesterOptions;

export function createFetchSampleApi(options: FetchSampleApiOptions): SampleApi {
  const request = createApiRequester(options);
  return {
    list: async () => (await answered(request("GET", "/samples", Samples))).samples,
    get: (token) => answered(request("GET", `/samples/${encodeURIComponent(token)}`, SharedOverview)),
  };
}
