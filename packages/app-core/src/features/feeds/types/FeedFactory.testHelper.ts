import { FeedId, type FeedEntry, type FeedSnapshot, type FollowedFeed } from "@overview/domain";

export const FEED_URL = "https://show.example/feed.xml";

export const makeFollowedFeed = (overrides: Partial<FollowedFeed> = {}): FollowedFeed => ({
  id: FeedId.parse("0cb4b1aa1f22cde55bb7358619c179248959500ab1a3de1d994f48e8f8eded53"),
  feedUrl: FEED_URL,
  kind: "podcast",
  title: "The History Show",
  siteUrl: "https://show.example/",
  imageUrl: "https://show.example/art.jpg",
  followedAt: "2026-11-20T09:00:00.000Z",
  pace: "whenChosen",
  order: "newestFirst",
  unavailable: null,
  ...overrides,
});

export const makeFeedEntry = (id: string, publishedAt: string | null, overrides: Partial<FeedEntry> = {}): FeedEntry => ({
  id,
  kind: "episode",
  title: `Episode ${id}`,
  pageUrl: `https://show.example/${id}`,
  publishedAt,
  durationSeconds: 3600,
  audioUrl: `https://cdn.show.example/${id}.mp3`,
  youTubeVideoId: null,
  imageUrl: null,
  description: "",
  ...overrides,
});

export const makeFeedSnapshot = (entries: FeedEntry[], overrides: Partial<FeedSnapshot> = {}): FeedSnapshot => ({
  feedUrl: FEED_URL,
  kind: "podcast",
  title: "The History Show",
  siteUrl: "https://show.example/",
  imageUrl: "https://show.example/art.jpg",
  entries,
  fetchedAt: "2026-11-28T09:00:00.000Z",
  freshness: "read",
  ...overrides,
});
