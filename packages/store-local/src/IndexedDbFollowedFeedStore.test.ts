import assert from "node:assert/strict";
import test from "node:test";
import { defineFollowedFeedStoreConformanceSuite, makeFollowedFeed } from "@overview/store-conformance";
import { CURRENT_FOLLOWED_FEED_SCHEMA_VERSION, FeedId } from "@overview/domain";
import { IndexedDbFollowedFeedStore } from "./IndexedDbFollowedFeedStore.js";
import { FOLLOWED_FEEDS_STORE } from "./localDatabaseSchema.js";
import { openEnrolledDatabase, openTestDatabase, putRaw, readOutbox, readRaw } from "./enrolledDatabase.testHelper.js";

defineFollowedFeedStoreConformanceSuite("IndexedDbFollowedFeedStore", async () => new IndexedDbFollowedFeedStore(await openTestDatabase()));

test("following a feed in an enrolled library journals the stored record, so every signed-in device follows it", async () => {
  const db = await openEnrolledDatabase();
  let journaled = 0;
  const store = new IndexedDbFollowedFeedStore(db, { onJournaled: () => (journaled += 1) });
  const feed = makeFollowedFeed();

  await store.saveFollowed(feed);

  const stored = await readRaw(db, FOLLOWED_FEEDS_STORE, feed.id);
  assert.equal(stored.schemaVersion, CURRENT_FOLLOWED_FEED_SCHEMA_VERSION);
  assert.deepEqual(
    (await readOutbox(db)).map(({ kind, id, change }) => ({ kind, id, change })),
    [{ kind: "followedFeed", id: feed.id, change: { op: "replace", record: stored } }],
  );
  assert.equal(journaled, 1);
});

test("unfollowing a feed journals a delete, and unfollowing one that isn't followed journals nothing", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbFollowedFeedStore(db);
  const feed = makeFollowedFeed();
  await store.saveFollowed(feed);

  await store.unfollow(feed.id);
  await store.unfollow(FeedId.parse("0".repeat(64)));

  assert.deepEqual(
    (await readOutbox(db)).map(({ kind, change }) => [kind, change.op]),
    [
      ["followedFeed", "replace"],
      ["followedFeed", "delete"],
    ],
  );
});

test("checking a feed is this device's own and journals nothing", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbFollowedFeedStore(db);
  await store.saveCheck({ feedId: makeFollowedFeed().id, seenEntryIds: [], checkedAt: "2026-11-28T09:00:00.000Z" });
  assert.deepEqual(await readOutbox(db), []);
});

test("a stored feed this client cannot read is left out of the list rather than breaking it", async () => {
  const db = await openTestDatabase();
  const store = new IndexedDbFollowedFeedStore(db);
  await store.saveFollowed(makeFollowedFeed());
  await putRaw(db, FOLLOWED_FEEDS_STORE, { id: "1".repeat(64), schemaVersion: CURRENT_FOLLOWED_FEED_SCHEMA_VERSION + 1 });

  assert.deepEqual(await store.listFollowed(), [makeFollowedFeed()]);
});
