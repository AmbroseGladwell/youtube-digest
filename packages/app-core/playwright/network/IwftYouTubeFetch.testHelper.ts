import type { YouTubeFetch } from "@overview/transcripts";

// A real browser fetch, so page.route intercepts it and getCallCount keeps counting the
// same way it does for every other endpoint. That also means the real request builder is
// exercised rather than stubbed (frontend-testing-guide.md 4.4).
export const iwftYouTubeFetch: YouTubeFetch = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  return { status: response.status, body: await response.text() };
};
