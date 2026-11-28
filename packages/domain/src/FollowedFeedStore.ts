import type { FeedId } from "./Brands.js";
import type { FollowedFeed } from "./FollowedFeed.js";

// Never synced, so each device checks for itself: docs/features/followed-feeds.md, "New entries".
export interface FollowedFeedCheck {
  feedId: FeedId;
  seenEntryIds: string[];
  checkedAt: string;
}

export interface FollowedFeedStore {
  listFollowed(): Promise<FollowedFeed[]>;
  saveFollowed(feed: FollowedFeed): Promise<void>;
  unfollow(feedId: FeedId): Promise<void>;
  getCheck(feedId: FeedId): Promise<FollowedFeedCheck | null>;
  saveCheck(check: FollowedFeedCheck): Promise<void>;
}
