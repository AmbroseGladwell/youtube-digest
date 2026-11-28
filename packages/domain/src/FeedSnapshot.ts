import { z } from "zod";

export const FEEDS_PATH = "/feeds";
export const MOST_FEEDS_FOLLOWED = 50;

export const FeedKind = z.enum(["podcast", "youTubeChannel", "blog"]);
export type FeedKind = z.infer<typeof FeedKind>;

export const FeedEntryKind = z.enum(["episode", "video", "article"]);
export type FeedEntryKind = z.infer<typeof FeedEntryKind>;

export const FeedEntry = z.object({
  id: z.string(),
  kind: FeedEntryKind,
  title: z.string().nullable(),
  pageUrl: z.url().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  audioUrl: z.url().nullable(),
  youTubeVideoId: z.string().nullable(),
  imageUrl: z.url().nullable(),
  description: z.string(),
});
export type FeedEntry = z.infer<typeof FeedEntry>;

// docs/features/followed-feeds.md, "The stored copy".
export const FeedFreshness = z.enum(["read", "stored", "failing", "gone"]);
export type FeedFreshness = z.infer<typeof FeedFreshness>;

export const FeedSnapshot = z.object({
  feedUrl: z.url(),
  kind: FeedKind,
  title: z.string().nullable(),
  siteUrl: z.url().nullable(),
  imageUrl: z.url().nullable(),
  entries: z.array(FeedEntry),
  fetchedAt: z.iso.datetime(),
  freshness: FeedFreshness,
});
export type FeedSnapshot = z.infer<typeof FeedSnapshot>;

export const FeedReadFailure = z.enum(["unreachable", "closed", "missing", "notAFeed", "noFeedOnPage", "noPublicFeed", "busy"]);
export type FeedReadFailure = z.infer<typeof FeedReadFailure>;

export const FeedRead = z.discriminatedUnion("status", [
  z.object({ status: z.literal("read"), feed: FeedSnapshot }),
  z.object({ status: z.literal("failed"), reason: FeedReadFailure }),
]);
export type FeedRead = z.infer<typeof FeedRead>;

export const FeedLookupBody = z.object({ url: z.string().min(1).max(2048) });
export type FeedLookupBody = z.infer<typeof FeedLookupBody>;

export const FeedCheckBody = z.object({ feedUrls: z.array(z.url().max(2048)).min(1).max(MOST_FEEDS_FOLLOWED) });
export type FeedCheckBody = z.infer<typeof FeedCheckBody>;

export const FeedChecked = z.object({ feedUrl: z.url(), read: FeedRead });
export type FeedChecked = z.infer<typeof FeedChecked>;

export const FeedCheck = z.object({ feeds: z.array(FeedChecked) });
export type FeedCheck = z.infer<typeof FeedCheck>;
