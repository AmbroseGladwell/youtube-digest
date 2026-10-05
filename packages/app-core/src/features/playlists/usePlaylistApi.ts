import { useMemo } from "react";
import { createFetchPlaylistApi, type PlaylistApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

// Null in a shell with no server to ask, where nothing about playlists is offered
// (docs/features/playlists.md, "Looking a playlist up").
export function usePlaylistApi(): { api: PlaylistApi; apiUrl: string } | null {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  return useMemo(
    () => (apiUrl === null ? null : { api: createFetchPlaylistApi({ baseUrl: apiUrl, surface }), apiUrl }),
    [apiUrl, surface],
  );
}
