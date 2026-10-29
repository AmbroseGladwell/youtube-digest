import { useCallback } from "react";
import { createFetchEventsApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useAnalyticsContext } from "../analytics/useAnalyticsContext.js";
import { declineAnalyticsConsent } from "./useAnalyticsConsent.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

// A reader without an account saying no: recorded, and told to the server once with no id
// when it is a decline rather than a withdrawal, so declines can be counted. Telling it
// never fails or waits for anything the reader did (docs/features/analytics-consent.md).
export function useAnalyticsDecline(): () => void {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  const context = useAnalyticsContext();
  return useCallback(() => {
    if (!declineAnalyticsConsent().declined || apiUrl === null) return;
    void createFetchEventsApi({ baseUrl: apiUrl, token: null, surface })
      .declined(context)
      .catch(() => undefined);
  }, [apiUrl, surface, context]);
}
