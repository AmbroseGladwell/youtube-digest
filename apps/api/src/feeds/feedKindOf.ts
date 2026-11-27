import type { FeedEntry, FeedKind } from "@overview/domain";

export const youTubeChannelIdOfFeed = (feedUrl: string): string | null => {
  const url = new URL(feedUrl);
  return /(^|\.)youtube\.com$/.test(url.hostname) && url.pathname === "/feeds/videos.xml" ? url.searchParams.get("channel_id") : null;
};

// Why the label is the feed's main kind and each entry keeps its own: docs/features/followed-feeds.md, "Kinds".
export const feedKindOf = (feedUrl: string, entries: FeedEntry[]): FeedKind => {
  if (youTubeChannelIdOfFeed(feedUrl) !== null) {
    return "youTubeChannel";
  }
  const episodes = entries.filter((entry) => entry.kind === "episode").length;
  return episodes > 0 && episodes * 2 >= entries.length ? "podcast" : "blog";
};
