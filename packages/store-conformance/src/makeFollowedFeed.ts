import { FeedId, type FollowedFeed } from "@overview/domain";

export const FOLLOWED_FEED_URL = "https://blog.example/feed.xml";

export const makeFollowedFeed = (overrides: Partial<FollowedFeed> = {}): FollowedFeed => ({
  id: FeedId.parse("bac559c521ff282fcea5be3142eaae1e675861eb4bdc0e990ceb1f58f70621de"),
  feedUrl: FOLLOWED_FEED_URL,
  kind: "blog",
  title: "A blog",
  siteUrl: "https://blog.example/",
  imageUrl: null,
  followedAt: "2026-11-28T09:00:00.000Z",
  pace: "whenChosen",
  order: "newestFirst",
  unavailable: null,
  ...overrides,
});
