import { queryOptions, useQuery } from "@tanstack/react-query";
import type { PlaylistId } from "@overview/domain";
import type { PlaylistApi } from "@overview/sync";
import { playlistKeys } from "../playlistKeys.js";
import { usePlaylistApi } from "../usePlaylistApi.js";

export const playlistLookupQueryOptions = (api: PlaylistApi | null, apiUrl: string | null, playlistId: PlaylistId) =>
  queryOptions({
    queryKey: playlistKeys.lookup(apiUrl, playlistId),
    queryFn: () => api!.lookup(playlistId),
    enabled: api !== null,
    retry: false,
  });

export function usePlaylistLookupQuery(playlistId: PlaylistId | null) {
  const playlistApi = usePlaylistApi();
  return useQuery({
    ...playlistLookupQueryOptions(playlistApi?.api ?? null, playlistApi?.apiUrl ?? null, playlistId ?? ("" as PlaylistId)),
    enabled: playlistApi !== null && playlistId !== null,
  });
}
