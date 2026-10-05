import test from "node:test";
import assert from "node:assert/strict";
import { PlaylistId, VideoId, type FollowedPlaylistStore } from "@overview/domain";
import { makeFollowedPlaylist } from "./makeFollowedPlaylist.js";

export function defineFollowedPlaylistStoreConformanceSuite(
  label: string,
  createStore: () => FollowedPlaylistStore | Promise<FollowedPlaylistStore>,
): void {
  const behaviour = (description: string) => `${label} FollowedPlaylistStore: ${description}`;

  test(behaviour("follows nothing until a playlist is saved"), async () => {
    const store = await createStore();
    assert.deepEqual(await store.listFollowed(), []);
  });

  test(behaviour("saveFollowed() adds a playlist, and saving it again replaces it rather than adding a second"), async () => {
    const store = await createStore();
    await store.saveFollowed(makeFollowedPlaylist());
    await store.saveFollowed(makeFollowedPlaylist({ title: "Psychology, renamed" }));
    assert.deepEqual(await store.listFollowed(), [makeFollowedPlaylist({ title: "Psychology, renamed" })]);
  });

  test(behaviour("unfollow() removes the playlist and what this device had seen of it"), async () => {
    const store = await createStore();
    const playlist = makeFollowedPlaylist();
    await store.saveFollowed(playlist);
    await store.saveCheck({ playlistId: playlist.id, seenVideoIds: [VideoId.parse("a")], checkedAt: playlist.followedAt });
    await store.unfollow(playlist.id);
    assert.deepEqual(await store.listFollowed(), []);
    assert.equal(await store.getCheck(playlist.id), null);
  });

  test(behaviour("unfollow() of a playlist that isn't followed does nothing"), async () => {
    const store = await createStore();
    await store.saveFollowed(makeFollowedPlaylist());
    await store.unfollow(PlaylistId.parse("PLelse"));
    assert.equal((await store.listFollowed()).length, 1);
  });

  test(behaviour("a playlist this device has never checked has no check"), async () => {
    const store = await createStore();
    assert.equal(await store.getCheck(PlaylistId.parse("PLpsychology")), null);
  });

  test(behaviour("saveCheck() replaces the last check for that playlist"), async () => {
    const store = await createStore();
    const playlistId = PlaylistId.parse("PLpsychology");
    await store.saveCheck({ playlistId, seenVideoIds: [VideoId.parse("a")], checkedAt: "2026-10-05T09:00:00.000Z" });
    const later = { playlistId, seenVideoIds: [VideoId.parse("a"), VideoId.parse("b")], checkedAt: "2026-10-05T10:00:00.000Z" };
    await store.saveCheck(later);
    assert.deepEqual(await store.getCheck(playlistId), later);
  });
}
