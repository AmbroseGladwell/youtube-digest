import type { YouTubeFetch } from "@overview/transcripts";

// A real browser fetch, so page.route intercepts and counts it like every other endpoint.
export const iwftYouTubeFetch: YouTubeFetch = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  return { status: response.status, body: await response.text() };
};
