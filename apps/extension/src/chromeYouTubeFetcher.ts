import type { YouTubeFetch } from "@overview/app-core";
import { YOUTUBE_FETCH, isYouTubeFetchReply } from "./youTubeFetchBridge.js";

// A throw gets one retry, right for a worker that failed to wake.
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
