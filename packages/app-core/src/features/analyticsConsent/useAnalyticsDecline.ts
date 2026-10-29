import { useCallback } from "react";
import { createFetchEventsApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useAnalyticsContext } from "../analytics/useAnalyticsContext.js";
import { declineAnalyticsConsent } from "./useAnalyticsConsent.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

// docs/features/analytics-consent.md, "A no is counted with no id".
export function useAnalyticsDecline(): () => void {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  const context = useAnalyticsContext();
  return useCallback(() => {
    const { declined } = declineAnalyticsConsent();
    if (!declined || apiUrl === null) return;
    void createFetchEventsApi({ baseUrl: apiUrl, token: null, surface })
      .declined(context)
      .catch(() => undefined);
  }, [apiUrl, surface, context]);
}
