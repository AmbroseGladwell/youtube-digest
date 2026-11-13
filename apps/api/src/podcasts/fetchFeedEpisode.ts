import type { PodcastReadFailure } from "@overview/domain";
import type { createPublicWebFetch } from "../publicWeb/createPublicWebFetch.js";
import { readFeedEpisode, type FeedEpisode, type FeedItem } from "./readFeedEpisode.js";

export type FeedRead = { status: "feed"; feed: FeedEpisode } | { status: "failed"; reason: PodcastReadFailure };

const FEED = "application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.1";
export const MOST_FEED_BYTES = 50 * 1024 * 1024;

async function* decodedChunks(body: ReadableStream<Uint8Array>, mostBytes: number): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let bytes = 0;
  try {
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      bytes += read.value.byteLength;
      if (bytes > mostBytes) return;
      yield decoder.decode(read.value, { stream: true });
    }
    yield decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

// docs/features/podcast-links.md, "Reading a feed"
export async function fetchFeedEpisode(
  fetchPublicWeb: ReturnType<typeof createPublicWebFetch>,
  feedUrl: string,
  isWanted: (item: FeedItem) => boolean,
  mostBytes = MOST_FEED_BYTES,
): Promise<FeedRead> {
  const answer = await fetchPublicWeb(feedUrl, { accept: FEED });
  if (answer.status === "failed") return { status: "failed", reason: answer.reason === "no-answer" ? "no-answer" : "no-public-feed" };
  if (answer.response.body === null) return { status: "failed", reason: "feed-unreadable" };
  try {
    const feed = await readFeedEpisode(decodedChunks(answer.response.body as ReadableStream<Uint8Array>, mostBytes), isWanted);
    if (feed.show.title === null && feed.itemsRead === 0) return { status: "failed", reason: "feed-unreadable" };
    return { status: "feed", feed };
  } catch {
    return { status: "failed", reason: "no-answer" };
  }
}

export const feedItemGuid = (item: FeedItem): string | null => item.guid ?? item.audioUrl;
