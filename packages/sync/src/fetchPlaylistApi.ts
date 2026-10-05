import { PlaylistLookup } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { PlaylistApi } from "./PlaylistApi.js";

export type FetchPlaylistApiOptions = ApiRequesterOptions;

export function createFetchPlaylistApi(options: FetchPlaylistApiOptions): PlaylistApi {
  const request = createApiRequester(options);
  return {
    lookup: (playlistId) =>
      answered(request("GET", `/playlists/${encodeURIComponent(playlistId)}`, PlaylistLookup)),
  };
}
