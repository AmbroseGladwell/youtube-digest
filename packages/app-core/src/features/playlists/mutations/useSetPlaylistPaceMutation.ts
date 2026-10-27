import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FollowedPlaylist, PlaylistPace } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { playlistKeys } from "../playlistKeys.js";
import type { FollowedPlaylistWithCheck } from "../queries/followedPlaylistsQuery.js";

export interface SetPlaylistPaceVariables {
  playlist: FollowedPlaylist;
  pace: PlaylistPace;
}

interface SetPlaylistPaceContext {
  previous: FollowedPlaylistWithCheck[] | undefined;
}

export const applyPace = (followed: FollowedPlaylistWithCheck[], { playlist, pace }: SetPlaylistPaceVariables) =>
  followed.map((each) => (each.playlist.id === playlist.id ? { ...each, playlist: { ...each.playlist, pace } } : each));

// Saved as soon as it is chosen, for every device; the queue takes the new pace straight
// away (docs/features/playlists.md, "A pace for each playlist").
export function useSetPlaylistPaceMutation() {
  const { followedPlaylistStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetPlaylistPaceVariables, SetPlaylistPaceContext>({
    mutationKey: playlistKeys.all,
    mutationFn: async ({ playlist, pace }) => {
      const stored = (await followedPlaylistStore.listFollowed()).find((each) => each.id === playlist.id);
      if (stored === undefined) return;
      await followedPlaylistStore.saveFollowed({ ...stored, pace });
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: playlistKeys.followed() });
      const previous = queryClient.getQueryData<FollowedPlaylistWithCheck[]>(playlistKeys.followed());
      queryClient.setQueryData<FollowedPlaylistWithCheck[]>(playlistKeys.followed(), (current) =>
        current === undefined ? current : applyPace(current, variables),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(playlistKeys.followed(), context.previous);
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: playlistKeys.all }) === 1) {
        await queryClient.invalidateQueries({ queryKey: playlistKeys.followed() });
      }
    },
  });
}
