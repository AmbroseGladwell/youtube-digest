import type { YouTubeFetchRequest, YouTubeFetchResponse } from "@overview/app-core";
import { isAllowedYouTubeUrl } from "./youTubeFetchBridge.js";

// credentials: "omit": docs/features/transcript-retrieval.md, "The request is anonymous on purpose".
export const fetchYouTubeInWorker = async (request: YouTubeFetchRequest): Promise<YouTubeFetchResponse> => {
  if (!isAllowedYouTubeUrl(request.url)) {
    throw new Error("the YouTube fetch bridge was asked for something that is not YouTube");
  }

  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
    credentials: "omit",
  });

  return { status: response.status, body: await response.text() };
};
