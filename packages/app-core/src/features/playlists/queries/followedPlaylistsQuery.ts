import { queryOptions, useQuery } from "@tanstack/react-query";
import type { FollowedPlaylist, FollowedPlaylistStore, PlaylistCheck } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { playlistKeys } from "../playlistKeys.js";

export interface FollowedPlaylistWithCheck {
  playlist: FollowedPlaylist;
  check: PlaylistCheck | null;
}

// Followed first, oldest first: the order they were followed in.
export const followedPlaylistsQueryOptions = (store: FollowedPlaylistStore) =>
  queryOptions({
    queryKey: playlistKeys.followed(),
    queryFn: async (): Promise<FollowedPlaylistWithCheck[]> => {
      const followed = (await store.listFollowed()).sort((left, right) => left.followedAt.localeCompare(right.followedAt));
      const checks = await Promise.all(followed.map((playlist) => store.getCheck(playlist.id)));
      return followed.map((playlist, index) => ({ playlist, check: checks[index] ?? null }));
    },
  });

export function useFollowedPlaylistsQuery() {
  const { followedPlaylistStore } = useStores();
  return useQuery(followedPlaylistsQueryOptions(followedPlaylistStore));
}
