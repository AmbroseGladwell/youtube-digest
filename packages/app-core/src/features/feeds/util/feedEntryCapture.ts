import type { FollowedFeed, KeptCapture, OverviewId, PodcastSource } from "@overview/domain";
import type { KeyedFeedEntry } from "../types/KeyedFeedEntry.js";

// An episode keeps its feed and guid, so it can be read again when it's made (docs/features/followed-feeds.md).
const episodeSource = ({ entry, sourceKey, url }: KeyedFeedEntry, feed: FollowedFeed): PodcastSource | null =>
  entry.kind !== "episode" || entry.audioUrl === null
    ? null
    : {
        kind: "podcast",
        id: sourceKey.slice(sourceKey.indexOf(":") + 1) as PodcastSource["id"],
        feedUrl: feed.feedUrl,
        guid: entry.id,
        title: entry.title ?? "",
        showName: feed.title ?? new URL(feed.feedUrl).hostname,
        publishedAt: entry.publishedAt,
        durationMs: entry.durationSeconds === null ? null : entry.durationSeconds * 1000,
        audioUrl: entry.audioUrl,
        pageUrl: entry.pageUrl,
        imageUrl: entry.imageUrl ?? feed.imageUrl,
        sharedFrom: url,
      };

// Waits for the reader under the id its overview will take (docs/features/followed-feeds.md, "Entries").
export const feedEntryCapture = (keyed: KeyedFeedEntry, feed: FollowedFeed, id: OverviewId, keptAt: Date): KeptCapture => ({
  id,
  sourceKey: keyed.sourceKey,
  url: keyed.url,
  keptAt: keptAt.toISOString(),
  keptFrom: "feed",
  captureReason: null,
  title: keyed.entry.title,
  thumbnailUrl: keyed.entry.imageUrl ?? feed.imageUrl,
  fromPlaylist: null,
  addedAt: keyed.entry.publishedAt,
  playlistIndex: null,
  chosenAt: null,
  fromFeed: { id: feed.id, kind: feed.kind, title: feed.title },
  stage: "kept",
  source: episodeSource(keyed, feed),
  waitingFor: "turn",
  resumesAt: null,
  queueStatus: "waiting",
  problem: null,
});
