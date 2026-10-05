import { ServiceTranscriptStatus, StoredTranscript } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { ServiceTranscriptApi } from "./ServiceTranscriptApi.js";

export function createFetchServiceTranscriptApi(options: ApiRequesterOptions): ServiceTranscriptApi {
  const request = createApiRequester(options);
  return {
    status: () => answered(request("GET", "/service-transcripts", ServiceTranscriptStatus)),
    fetch: (videoId) => answered(request("POST", `/service-transcripts/${encodeURIComponent(videoId)}`, StoredTranscript)),
  };
}
