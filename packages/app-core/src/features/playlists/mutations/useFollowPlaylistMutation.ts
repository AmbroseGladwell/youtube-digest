import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FollowedPlaylist, PlaylistLookup } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { captureQueueKeys } from "../../captureQueue/captureQueueKeys.js";
import { playlistKeys } from "../playlistKeys.js";
import { capturesFor } from "../util/capturesFor.js";
import { knownVideoIds } from "../util/knownVideoIds.js";

export interface FollowPlaylistVariables {
  lookup: PlaylistLookup;
  backfill: boolean;
}

// Following records the playlist for every device and marks everything in it as seen here,
// so only what is added later is queued on its own. The backfill, when asked for, queues
// what is already there (docs/features/playlists.md, "Following").
export function useFollowPlaylistMutation() {
  const { followedPlaylistStore, captureQueueStore, overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<{ queued: number }, Error, FollowPlaylistVariables>({
    mutationKey: playlistKeys.all,
    mutationFn: async ({ lookup, backfill }) => {
      const now = new Date();
      const existing = (await followedPlaylistStore.listFollowed()).find((playlist) => playlist.id === lookup.id);
      const followed: FollowedPlaylist = {
        id: lookup.id,
        title: lookup.title,
        owner: lookup.owner,
        privacy: lookup.privacy,
        followedAt: existing?.followedAt ?? now.toISOString(),
        unavailable: null,
      };
      await followedPlaylistStore.saveFollowed(followed);
      await followedPlaylistStore.saveCheck({
        playlistId: lookup.id,
        seenVideoIds: lookup.entries.map((entry) => entry.videoId),
        checkedAt: now.toISOString(),
      });
      if (!backfill) return { queued: 0 };

      const known = await knownVideoIds(overviewStore, captureQueueStore);
      const captures = capturesFor(
        lookup.entries.filter((entry) => !known.has(entry.videoId)),
        { id: lookup.id, title: lookup.title },
        now,
      );
      await captureQueueStore.enqueue(captures);
      return { queued: captures.filter((capture) => capture.status === "waiting").length };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: playlistKeys.followed() });
      void queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
    },
  });
}
