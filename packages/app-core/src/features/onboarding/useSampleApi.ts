import { useMemo } from "react";
import { createFetchSampleApi, type SampleApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

// Null in a shell with no server to ask, where Start offers no samples
// (docs/features/onboarding.md, "Try a sample").
export function useSampleApi(): { api: SampleApi; apiUrl: string } | null {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  return useMemo(() => (apiUrl === null ? null : { api: createFetchSampleApi({ baseUrl: apiUrl, surface }), apiUrl }), [apiUrl, surface]);
}
