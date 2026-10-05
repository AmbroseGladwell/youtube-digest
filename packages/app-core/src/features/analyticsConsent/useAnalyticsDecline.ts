import { useCallback } from "react";
import { createFetchEventsApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useAnalyticsContext } from "../analytics/useAnalyticsContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

// A reader without an account saying no, told to the server once with no id, so declines
// can be counted; it never fails or waits for anything the reader did
// (docs/features/analytics-consent.md).
export function useAnalyticsDecline(): () => void {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  const context = useAnalyticsContext();
  return useCallback(() => {
    if (apiUrl === null) return;
    void createFetchEventsApi({ baseUrl: apiUrl, token: null, surface })
      .declined(context)
      .catch(() => undefined);
  }, [apiUrl, surface, context]);
}
