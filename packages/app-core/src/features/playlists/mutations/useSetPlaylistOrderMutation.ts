import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FollowedPlaylist, PlaylistOrder } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { playlistKeys } from "../playlistKeys.js";
import type { FollowedPlaylistWithCheck } from "../queries/followedPlaylistsQuery.js";

export interface SetPlaylistOrderVariables {
  playlist: FollowedPlaylist;
  order: PlaylistOrder;
}

interface SetPlaylistOrderContext {
  previous: FollowedPlaylistWithCheck[] | undefined;
}

export const applyOrder = (followed: FollowedPlaylistWithCheck[], { playlist, order }: SetPlaylistOrderVariables) =>
  followed.map((each) => (each.playlist.id === playlist.id ? { ...each, playlist: { ...each.playlist, order } } : each));

// Saved as soon as it is chosen, for every device; the videos already waiting are put in the
// new order straight away (docs/features/playlists.md, "An order for each playlist").
export function useSetPlaylistOrderMutation() {
  const { followedPlaylistStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetPlaylistOrderVariables, SetPlaylistOrderContext>({
    mutationKey: playlistKeys.all,
    mutationFn: async ({ playlist, order }) => {
      const stored = (await followedPlaylistStore.listFollowed()).find((each) => each.id === playlist.id);
      if (stored === undefined) return;
      await followedPlaylistStore.saveFollowed({ ...stored, order });
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: playlistKeys.followed() });
      const previous = queryClient.getQueryData<FollowedPlaylistWithCheck[]>(playlistKeys.followed());
      queryClient.setQueryData<FollowedPlaylistWithCheck[]>(playlistKeys.followed(), (current) =>
        current === undefined ? current : applyOrder(current, variables),
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
