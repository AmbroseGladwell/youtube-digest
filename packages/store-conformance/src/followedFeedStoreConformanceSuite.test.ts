import type { FeedId, FollowedFeed, FollowedFeedCheck, FollowedFeedStore } from "@overview/domain";
import { defineFollowedFeedStoreConformanceSuite } from "./followedFeedStoreConformanceSuite.js";

class InMemoryFollowedFeedStore implements FollowedFeedStore {
  #followed = new Map<FeedId, FollowedFeed>();
  #checks = new Map<FeedId, FollowedFeedCheck>();

  async listFollowed() {
    return [...this.#followed.values()];
  }

  async saveFollowed(feed: FollowedFeed) {
    this.#followed.set(feed.id, feed);
  }

  async unfollow(feedId: FeedId) {
    this.#followed.delete(feedId);
    this.#checks.delete(feedId);
  }

  async getCheck(feedId: FeedId) {
    return this.#checks.get(feedId) ?? null;
  }

  async saveCheck(check: FollowedFeedCheck) {
    this.#checks.set(check.feedId, check);
  }
}

defineFollowedFeedStoreConformanceSuite("InMemoryFollowedFeedStore (reference)", () => new InMemoryFollowedFeedStore());
