import type { YouTubeFetch } from "@overview/app-core";
import { YOUTUBE_FETCH, isYouTubeFetchReply } from "./youTubeFetchBridge.js";

// A throw here is an unrecognised failure, which withSingleRetry treats as worth one
// retry — right, because a worker that was asleep and failed to wake is the textbook
// transient (docs/features/transcript-retrieval.md).
export const chromeYouTubeFetcher: YouTubeFetch = async (request) => {
  const reply = (await chrome.runtime.sendMessage({ type: YOUTUBE_FETCH, request })) as unknown;

  if (!isYouTubeFetchReply(reply)) {
    throw new Error("the extension worker did not answer a YouTube fetch");
  }
  if (!reply.ok) {
    throw new Error(reply.message);
  }
  return reply.response;
};
