import { NarrationRender, narrationKey } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { NarrationApi } from "./NarrationApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

export type FetchNarrationApiOptions = ApiRequesterOptions;

export function createFetchNarrationApi(options: FetchNarrationApiOptions): NarrationApi {
  const request = createApiRequester(options);
  const root = options.baseUrl.replace(/\/+$/, "");
  const status = (key: string) => answered(request("GET", `/audio/${key}`, NarrationRender));

  return {
    peek: async (lines, voice) =>
      status(await narrationKey(lines, voice)).catch((error: unknown) => {
        if (isSyncRequestError(error) && error.code === "not_found") return null;
        throw error;
      }),
    request: (lines, voice, priority) =>
      answered(request("POST", "/audio", NarrationRender, { body: { lines, voice, priority } })),
    status,
    fileUrl: (render) => `${root}${render.fileUrl}`,
  };
}
