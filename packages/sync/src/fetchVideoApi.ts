import { VideoRead } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";

export interface VideoApi {
  read: (videoId: string) => Promise<VideoRead>;
}

export function createFetchVideoApi(options: ApiRequesterOptions): VideoApi {
  const request = createApiRequester(options);
  return {
    read: (videoId) => answered(request("POST", "/videos/read", VideoRead, { body: { videoId } })),
  };
}
