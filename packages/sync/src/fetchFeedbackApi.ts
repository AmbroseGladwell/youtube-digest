import { z } from "zod";
import { FEEDBACK_PATH } from "@overview/domain";
import { createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { FeedbackApi } from "./FeedbackApi.js";

export type FetchFeedbackApiOptions = ApiRequesterOptions;

export const createFetchFeedbackApi = (options: FetchFeedbackApiOptions): FeedbackApi => {
  const request = createApiRequester(options);
  return {
    send: async (feedback) => {
      await request("POST", FEEDBACK_PATH, z.unknown(), { body: feedback });
    },
  };
};
