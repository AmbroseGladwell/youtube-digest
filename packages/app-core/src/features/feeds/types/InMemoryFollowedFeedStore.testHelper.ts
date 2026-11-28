import type { FeedId, FollowedFeed, FollowedFeedCheck, FollowedFeedStore } from "@overview/domain";

export class InMemoryFollowedFeedStore implements FollowedFeedStore {
  #followed = new Map<string, FollowedFeed>();
  #checks = new Map<string, FollowedFeedCheck>();

  seedFollowed(feed: FollowedFeed): void {
    this.#followed.set(feed.id, feed);
  }

  seedCheck(check: FollowedFeedCheck): void {
    this.#checks.set(check.feedId, check);
  }

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
