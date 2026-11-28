import type { FollowedFeed, KeptCapture, OverviewId } from "@overview/domain";
import type { KeyedFeedEntry } from "../types/KeyedFeedEntry.js";

// Waits for the reader under the id its overview will take (docs/features/followed-feeds.md, "Entries").
export const feedEntryCapture = (
  { entry, sourceKey, url }: KeyedFeedEntry,
  feed: FollowedFeed,
  id: OverviewId,
  keptAt: Date,
): KeptCapture => ({
  id,
  sourceKey,
  url,
  keptAt: keptAt.toISOString(),
  keptFrom: "feed",
  captureReason: null,
  title: entry.title,
  thumbnailUrl: entry.imageUrl ?? feed.imageUrl,
  fromPlaylist: null,
  addedAt: entry.publishedAt,
  playlistIndex: null,
  chosenAt: null,
  fromFeed: { id: feed.id, kind: feed.kind, title: feed.title },
  stage: "kept",
  source: null,
  waitingFor: "turn",
  resumesAt: null,
  queueStatus: "waiting",
  problem: null,
});
