import type { YouTubeFetchRequest, YouTubeFetchResponse } from "@overview/app-core";
import { isAllowedYouTubeUrl } from "./youTubeFetchBridge.js";

// credentials: "include" so the request carries the user's own YouTube session where the
// browser will attach it. Nothing here depends on it — a public video needs no auth, and
// the point of fetching from this device is the address it comes from
// (docs/features/transcript-retrieval.md).
export async function fetchYouTubeInWorker(
  request: YouTubeFetchRequest,
): Promise<YouTubeFetchResponse> {
  if (!isAllowedYouTubeUrl(request.url)) {
    throw new Error("the YouTube fetch bridge was asked for something that is not YouTube");
  }

  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
    credentials: "include",
  });

  return { status: response.status, body: await response.text() };
}
