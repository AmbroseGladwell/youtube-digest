import { useMemo } from "react";
import { createFetchSampleApi, type SampleApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

export interface SampleApiAccess {
  api: SampleApi;
  apiUrl: string;
}

export const useSampleApi = (): SampleApiAccess | null => {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  return useMemo(() => (apiUrl === null ? null : { api: createFetchSampleApi({ baseUrl: apiUrl, surface }), apiUrl }), [apiUrl, surface]);
};
