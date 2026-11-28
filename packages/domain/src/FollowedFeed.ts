import { z } from "zod";
import { FeedId } from "./Brands.js";
import { FeedKind } from "./FeedSnapshot.js";
import { PlaylistPace } from "./PlaylistPace.js";

export const FOLLOWED_FEEDS_PATH = "/followed-feeds";

export const FeedOrder = z.enum(["newestFirst", "oldestFirst"]);
export type FeedOrder = z.infer<typeof FeedOrder>;

export const DEFAULT_FEED_PACE: PlaylistPace = "whenChosen";
export const DEFAULT_FEED_ORDER: FeedOrder = "newestFirst";

export const FeedUnavailable = z.enum(["gone"]);
export type FeedUnavailable = z.infer<typeof FeedUnavailable>;

// Synced; what each device has seen of it is its own (docs/features/followed-feeds.md, "Following").
export const FollowedFeed = z.object({
  id: FeedId,
  feedUrl: z.url(),
  kind: FeedKind,
  title: z.string().nullable(),
  siteUrl: z.url().nullable(),
  imageUrl: z.url().nullable().catch(null),
  followedAt: z.iso.datetime(),
  pace: PlaylistPace,
  order: FeedOrder,
  unavailable: FeedUnavailable.nullable(),
});
export type FollowedFeed = z.infer<typeof FollowedFeed>;
