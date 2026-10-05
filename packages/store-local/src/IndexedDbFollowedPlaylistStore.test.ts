import assert from "node:assert/strict";
import test from "node:test";
import { defineFollowedPlaylistStoreConformanceSuite, makeFollowedPlaylist } from "@overview/store-conformance";
import { CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION, PlaylistId } from "@overview/domain";
import { IndexedDbFollowedPlaylistStore } from "./IndexedDbFollowedPlaylistStore.js";
import { FOLLOWED_PLAYLISTS_STORE } from "./localDatabaseSchema.js";
import { openEnrolledDatabase, openTestDatabase, putRaw, readOutbox, readRaw } from "./enrolledDatabase.testHelper.js";

defineFollowedPlaylistStoreConformanceSuite(
  "IndexedDbFollowedPlaylistStore",
  async () => new IndexedDbFollowedPlaylistStore(await openTestDatabase()),
);

test("following in an enrolled library journals the stored record, so every signed-in device follows it", async () => {
  const db = await openEnrolledDatabase();
  let journaled = 0;
  const store = new IndexedDbFollowedPlaylistStore(db, { onJournaled: () => (journaled += 1) });
  const playlist = makeFollowedPlaylist();

  await store.saveFollowed(playlist);

  const stored = await readRaw(db, FOLLOWED_PLAYLISTS_STORE, playlist.id);
  assert.equal(stored.schemaVersion, CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION);
  assert.deepEqual(
    (await readOutbox(db)).map(({ kind, id, change }) => ({ kind, id, change })),
    [{ kind: "followedPlaylist", id: playlist.id, change: { op: "replace", record: stored } }],
  );
  assert.equal(journaled, 1);
});

test("unfollowing journals a delete, and unfollowing what isn't followed journals nothing", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbFollowedPlaylistStore(db);
  const playlist = makeFollowedPlaylist();
  await store.saveFollowed(playlist);

  await store.unfollow(playlist.id);
  await store.unfollow(PlaylistId.parse("PLnever"));

  assert.deepEqual(
    (await readOutbox(db)).map(({ kind, change }) => [kind, change.op]),
    [["followedPlaylist", "replace"], ["followedPlaylist", "delete"]],
  );
});

test("checking a playlist is this device's own and journals nothing", async () => {
  const db = await openEnrolledDatabase();
  const store = new IndexedDbFollowedPlaylistStore(db);
  await store.saveCheck({ playlistId: PlaylistId.parse("PLpsychology"), seenVideoIds: [], checkedAt: "2026-10-05T09:00:00.000Z" });
  assert.deepEqual(await readOutbox(db), []);
});

test("a stored playlist this client cannot read is left out of the list rather than breaking it", async () => {
  const db = await openTestDatabase();
  const store = new IndexedDbFollowedPlaylistStore(db);
  await store.saveFollowed(makeFollowedPlaylist());
  await putRaw(db, FOLLOWED_PLAYLISTS_STORE, { id: "PLbroken", schemaVersion: CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION + 1 });
  assert.deepEqual((await store.listFollowed()).map((playlist) => playlist.id), ["PLpsychology"]);
});
