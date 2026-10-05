import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlaylistId } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { captureQueueKeys } from "../../captureQueue/captureQueueKeys.js";
import { playlistKeys } from "../playlistKeys.js";

// Unfollowing takes the playlist's waiting videos out of the queue; what needs attention
// stays until it is dismissed, and the overviews already made keep their From line
// (docs/features/playlists.md, "Unfollowing").
export function useUnfollowPlaylistMutation() {
  const { followedPlaylistStore, captureQueueStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<{ waitingRemoved: number }, Error, PlaylistId>({
    mutationKey: playlistKeys.all,
    mutationFn: async (playlistId) => {
      const waitingRemoved = (await captureQueueStore.listQueue()).filter(
        (capture) => capture.status === "waiting" && capture.fromPlaylist.id === playlistId,
      ).length;
      await captureQueueStore.removeWaiting(playlistId);
      await followedPlaylistStore.unfollow(playlistId);
      return { waitingRemoved };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: playlistKeys.followed() });
      void queryClient.invalidateQueries({ queryKey: captureQueueKeys.all });
    },
  });
}
