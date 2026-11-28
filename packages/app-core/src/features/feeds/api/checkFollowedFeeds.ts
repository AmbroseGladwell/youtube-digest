import {
  MOST_WAITING_PER_FEED,
  OverviewId,
  type CaptureStore,
  type ClientWarningReport,
  type FeedSnapshot,
  type FollowedFeed,
  type FollowedFeedStore,
  type KeptCapture,
  type OverviewStore,
} from "@overview/domain";
import { isSyncRequestError, type FeedApi } from "@overview/sync";
import { libraryVideoIds } from "../../playlists/util/knownVideoIds.js";
import type { KeyedFeedEntry } from "../types/KeyedFeedEntry.js";
import { feedEntryCapture } from "../util/feedEntryCapture.js";
import { feedEntrySourceKey } from "../util/feedEntrySourceKey.js";
import { feedEntryUrl } from "../util/feedEntryUrl.js";
import { keptNewest } from "../util/keptNewest.js";
import { newFeedEntries } from "../util/newFeedEntries.js";

export interface FeedCheckDependencies {
  api: FeedApi;
  followedFeedStore: FollowedFeedStore;
  captureStore: CaptureStore;
  overviewStore: OverviewStore;
  now: () => Date;
  newId: () => string;
  warn: (warning: ClientWarningReport) => void;
}

export interface FeedCheckOutcome {
  arrived: number;
  dropped: number;
}

const keyed = async (snapshot: FeedSnapshot): Promise<KeyedFeedEntry[]> => {
  const all = await Promise.all(
    snapshot.entries.map(async (entry) => {
      const [sourceKey, url] = [await feedEntrySourceKey(snapshot.feedUrl, entry), feedEntryUrl(entry)];
      return sourceKey === null || url === null ? [] : [{ entry, sourceKey, url }];
    }),
  );
  return all.flat();
};

const refreshed = (feed: FollowedFeed, snapshot: FeedSnapshot): FollowedFeed => ({
  ...feed,
  kind: snapshot.kind,
  title: snapshot.title ?? feed.title,
  siteUrl: snapshot.siteUrl ?? feed.siteUrl,
  imageUrl: snapshot.imageUrl ?? feed.imageUrl,
  unavailable: snapshot.freshness === "gone" ? "gone" : null,
});

const changed = (before: FollowedFeed, after: FollowedFeed): boolean =>
  before.kind !== after.kind ||
  before.title !== after.title ||
  before.siteUrl !== after.siteUrl ||
  before.imageUrl !== after.imageUrl ||
  before.unavailable !== after.unavailable;

const waitingFrom = (captures: readonly KeptCapture[], feed: FollowedFeed): KeptCapture[] =>
  captures.filter((capture) => capture.fromFeed?.id === feed.id);

// Every followed feed once per opening: docs/features/followed-feeds.md, "Checking on opening".
export const checkFollowedFeeds = async (feeds: readonly FollowedFeed[], deps: FeedCheckDependencies): Promise<FeedCheckOutcome> => {
  const outcome = { arrived: 0, dropped: 0 };
  if (feeds.length === 0) {
    return outcome;
  }
  let checked;
  try {
    checked = await deps.api.check(feeds.map(({ feedUrl }) => feedUrl));
  } catch (error) {
    deps.warn({
      name: "feedCheckFailed",
      outcome: "failed",
      ...(isSyncRequestError(error) && error.requestId !== undefined ? { requestId: error.requestId } : {}),
      ...(isSyncRequestError(error) ? { apiErrorCode: error.code } : {}),
    });
    return outcome;
  }
  const captures = (await deps.captureStore.listCaptures()).filter((capture): capture is KeptCapture => capture.stage === "kept");
  const known = new Set<string>([...(await libraryVideoIds(deps.overviewStore)), ...captures.map(({ sourceKey }) => sourceKey)]);
  const byUrl = new Map(feeds.map((feed) => [feed.feedUrl, feed]));

  for (const { feedUrl, read } of checked.feeds) {
    const feed = byUrl.get(feedUrl);
    if (feed === undefined) {
      continue;
    }
    if (read.status === "failed") {
      deps.warn({ name: "feedCheckFailed", outcome: read.reason });
      continue;
    }
    const after = refreshed(feed, read.feed);
    if (changed(feed, after)) {
      await deps.followedFeedStore.saveFollowed(after);
    }
    const now = deps.now();
    const { fresh, seen } = newFeedEntries(await keyed(read.feed), feed, await deps.followedFeedStore.getCheck(feed.id), known);
    const { arriving, dropped } = keptNewest(waitingFrom(captures, feed), fresh, now, MOST_WAITING_PER_FEED);
    for (const [index, entry] of arriving.entries()) {
      await deps.captureStore.saveCapture(feedEntryCapture(entry, after, OverviewId.parse(deps.newId()), new Date(now.getTime() + index)));
      known.add(entry.sourceKey);
    }
    for (const capture of dropped) {
      await deps.captureStore.removeCapture(capture.id);
    }
    await deps.followedFeedStore.saveCheck({ feedId: feed.id, seenEntryIds: seen, checkedAt: now.toISOString() });
    outcome.arrived += arriving.length;
    outcome.dropped += dropped.length + fresh.length - arriving.length;
  }
  if (outcome.dropped > 0) {
    deps.warn({ name: "feedEntriesDropped", dropped: outcome.dropped });
  }
  return outcome;
};
