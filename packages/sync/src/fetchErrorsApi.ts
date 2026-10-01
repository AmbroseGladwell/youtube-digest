import { z } from "zod";
import { createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { ErrorsApi } from "./ErrorsApi.js";

export type FetchErrorsApiOptions = ApiRequesterOptions;

export function createFetchErrorsApi(options: FetchErrorsApiOptions): ErrorsApi {
  const request = createApiRequester(options);
  return {
    send: async (batch, { keepalive = false } = {}) => {
      await request("POST", "/errors", z.never(), { body: batch, keepalive });
    },
  };
}
