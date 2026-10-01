import { z } from "zod";
import { createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { EventsApi } from "./EventsApi.js";

export type FetchEventsApiOptions = ApiRequesterOptions;

export function createFetchEventsApi(options: FetchEventsApiOptions): EventsApi {
  const request = createApiRequester(options);
  return {
    send: async (batch, { keepalive = false } = {}) => {
      await request("POST", "/events", z.never(), { body: batch, keepalive });
    },
  };
}
