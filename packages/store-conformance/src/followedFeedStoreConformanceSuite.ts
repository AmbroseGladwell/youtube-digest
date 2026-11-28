import test from "node:test";
import assert from "node:assert/strict";
import { FeedId, type FollowedFeedStore } from "@overview/domain";
import { makeFollowedFeed } from "./makeFollowedFeed.js";

const ANOTHER_FEED = FeedId.parse("de99c1b059f3e9d2e30ee0f9da942363a4b868875e5326b8c981b05c396bcd33");

export const defineFollowedFeedStoreConformanceSuite = (
  label: string,
  createStore: () => FollowedFeedStore | Promise<FollowedFeedStore>,
): void => {
  const behaviour = (description: string) => `${label} FollowedFeedStore: ${description}`;

  test(behaviour("follows nothing until a feed is saved"), async () => {
    const store = await createStore();
    assert.deepEqual(await store.listFollowed(), []);
  });

  test(behaviour("saveFollowed() adds a feed, and saving it again replaces it rather than adding a second"), async () => {
    const store = await createStore();
    await store.saveFollowed(makeFollowedFeed());
    await store.saveFollowed(makeFollowedFeed({ pace: "oneADay" }));
    assert.deepEqual(await store.listFollowed(), [makeFollowedFeed({ pace: "oneADay" })]);
  });

  test(behaviour("unfollow() removes the feed and what this device had seen of it"), async () => {
    const store = await createStore();
    const feed = makeFollowedFeed();
    await store.saveFollowed(feed);
    await store.saveCheck({ feedId: feed.id, seenEntryIds: ["a"], checkedAt: feed.followedAt });
    await store.unfollow(feed.id);
    assert.deepEqual(await store.listFollowed(), []);
    assert.equal(await store.getCheck(feed.id), null);
  });

  test(behaviour("unfollow() of a feed that isn't followed does nothing"), async () => {
    const store = await createStore();
    await store.saveFollowed(makeFollowedFeed());
    await store.unfollow(ANOTHER_FEED);
    assert.equal((await store.listFollowed()).length, 1);
  });

  test(behaviour("saveCheck() replaces the last check for that feed, and a feed never checked has none"), async () => {
    const store = await createStore();
    const { id: feedId, followedAt } = makeFollowedFeed();
    await store.saveCheck({ feedId, seenEntryIds: ["a"], checkedAt: followedAt });
    const later = { feedId, seenEntryIds: ["a", "b"], checkedAt: "2026-11-28T10:00:00.000Z" };
    await store.saveCheck(later);
    assert.deepEqual(await store.getCheck(feedId), later);
    assert.equal(await store.getCheck(ANOTHER_FEED), null);
  });
};
