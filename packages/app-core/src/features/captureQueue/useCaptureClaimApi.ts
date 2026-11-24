import { useMemo } from "react";
import { createFetchCaptureClaimApi, type CaptureClaimApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";

export const useCaptureClaimApi = (): CaptureClaimApi | null => {
  const apiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  return useMemo(() => (apiUrl === null ? null : createFetchCaptureClaimApi({ baseUrl: apiUrl, surface })), [apiUrl, surface]);
};
