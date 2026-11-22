import { useMemo } from "react";
import { createFetchPlaylistApi, type PlaylistApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

export interface PlaylistApiAccess {
  api: PlaylistApi;
  apiUrl: string;
}

export const usePlaylistApi = (): PlaylistApiAccess | null => {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  return useMemo(() => (apiUrl === null ? null : { api: createFetchPlaylistApi({ baseUrl: apiUrl, surface }), apiUrl }), [apiUrl, surface]);
};
