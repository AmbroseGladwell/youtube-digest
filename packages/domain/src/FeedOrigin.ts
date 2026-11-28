import { z } from "zod";
import { FeedKind } from "./FeedSnapshot.js";
import { FeedId } from "./Brands.js";

// On the capture and its overview, so it outlives unfollowing: docs/features/followed-feeds.md, "Entries".
export const FeedOrigin = z.object({
  id: FeedId,
  kind: FeedKind,
  title: z.string().nullable(),
});
export type FeedOrigin = z.infer<typeof FeedOrigin>;
