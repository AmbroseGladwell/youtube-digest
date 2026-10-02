import { z } from "zod";
import { createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { SharedPageEventsApi } from "./SharedPageEventsApi.js";

export interface FetchSharedPageEventsApiOptions extends ApiRequesterOptions {
  token: string;
}

export function createFetchSharedPageEventsApi({ token, ...options }: FetchSharedPageEventsApiOptions): SharedPageEventsApi {
  const request = createApiRequester({ ...options, token: null });
  return {
    send: async (batch, { keepalive = false } = {}) => {
      await request("POST", `/shares/${encodeURIComponent(token)}/events`, z.never(), { body: batch, keepalive });
    },
  };
}
