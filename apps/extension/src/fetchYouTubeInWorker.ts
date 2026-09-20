import type { YouTubeFetchRequest, YouTubeFetchResponse } from "@overview/app-core";
import { isAllowedYouTubeUrl } from "./youTubeFetchBridge.js";

// credentials: "omit", and that is load-bearing rather than tidy. A signed-in session
// sends SAPISID, which makes InnerTube treat the call as authenticated and expect an
// Authorization: SAPISIDHASH header we have no way to produce — so it answers 403 for
// exactly the people most likely to be using this. Anonymous is the shape that works, and
// the point of fetching here was never the session: it is the address the request comes
// from (docs/features/transcript-retrieval.md).
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
    credentials: "omit",
  });

  return { status: response.status, body: await response.text() };
}
