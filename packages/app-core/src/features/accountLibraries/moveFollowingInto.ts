import type { CaptureQueueStore, FollowedPlaylistStore } from "@overview/domain";

export interface FollowingStores {
  followedPlaylistStore: FollowedPlaylistStore;
  captureQueueStore: CaptureQueueStore;
}

// The playlists this device followed without an account, what it had seen of each, and
// what it still had queued, into the account's library. Written there before it leaves
// here, so a move that stops is finished by running it again
// (docs/features/playlists.md, "Signing in").
export async function moveFollowingInto(from: FollowingStores, into: FollowingStores): Promise<{ playlists: number }> {
  const [leaving, held, queued] = await Promise.all([
    from.followedPlaylistStore.listFollowed(),
    into.followedPlaylistStore.listFollowed(),
    from.captureQueueStore.listQueue(),
  ]);
  const heldIds = new Set<string>(held.map((playlist) => playlist.id));

  for (const playlist of leaving) {
    if (!heldIds.has(playlist.id)) {
      await into.followedPlaylistStore.saveFollowed(playlist);
      const check = await from.followedPlaylistStore.getCheck(playlist.id);
      if (check !== null && (await into.followedPlaylistStore.getCheck(playlist.id)) === null) {
        await into.followedPlaylistStore.saveCheck(check);
      }
    }
    await from.followedPlaylistStore.unfollow(playlist.id);
  }

  await into.captureQueueStore.enqueue(queued);
  for (const capture of queued) await from.captureQueueStore.removeQueued(capture.videoId);

  return { playlists: leaving.filter((playlist) => !heldIds.has(playlist.id)).length };
}
