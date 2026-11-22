import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FollowedPlaylist, PlaylistLookup, PlaylistOrder, PlaylistPace } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { captureQueueKeys } from "../../captureQueue/captureQueueKeys.js";
import { playlistKeys } from "../playlistKeys.js";
import { capturesFor } from "../util/capturesFor.js";
import { placedEntries } from "../util/inPlaylistOrder.js";
import { knownVideoIds } from "../util/knownVideoIds.js";

export interface FollowPlaylistVariables {
  lookup: PlaylistLookup;
  backfill: boolean;
  // One already followed keeps its own, changed in Settings.
  pace: PlaylistPace;
  order: PlaylistOrder;
}

// docs/features/playlists.md, "Following".
export const useFollowPlaylistMutation = () => {
  const { followedPlaylistStore, captureQueueStore, overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<{ queued: number }, Error, FollowPlaylistVariables>({
    mutationKey: playlistKeys.all,
    mutationFn: async ({ lookup, backfill, pace, order }) => {
      const now = new Date();
      const existing = (await followedPlaylistStore.listFollowed()).find((playlist) => playlist.id === lookup.id);
      const followed: FollowedPlaylist = {
        id: lookup.id,
        title: lookup.title,
        owner: lookup.owner,
        privacy: lookup.privacy,
        followedAt: existing?.followedAt ?? now.toISOString(),
        unavailable: null,
        pace: existing?.pace ?? pace,
        order: existing?.order ?? order,
      };
      await followedPlaylistStore.saveFollowed(followed);
      await followedPlaylistStore.saveCheck({
        playlistId: lookup.id,
        seenVideoIds: lookup.entries.map((entry) => entry.videoId),
        checkedAt: now.toISOString(),
      });
      if (!backfill) {
        return { queued: 0 };
      }

      const known = await knownVideoIds(overviewStore, captureQueueStore);
      const captures = capturesFor(
        placedEntries(lookup.entries).filter((entry) => !known.has(entry.videoId)),
        { id: lookup.id, title: lookup.title },
        now,
      );
      await captureQueueStore.enqueue(captures);
      return { queued: captures.filter((capture) => capture.status === "waiting").length };
    },
    // The queue reads the pace before it sees the videos, so none is made as if it had no pace.
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: playlistKeys.followed() });
      await queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
    },
  });
};
