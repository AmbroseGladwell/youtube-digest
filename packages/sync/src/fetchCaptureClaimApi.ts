import { z } from "zod";
import { CAPTURE_CLAIMS_PATH, CaptureClaim } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { CaptureClaimApi } from "./CaptureClaimApi.js";

export type FetchCaptureClaimApiOptions = ApiRequesterOptions;

export const createFetchCaptureClaimApi = (options: FetchCaptureClaimApiOptions): CaptureClaimApi => {
  const request = createApiRequester(options);
  const path = (sourceKey: string) => `${CAPTURE_CLAIMS_PATH}/${encodeURIComponent(sourceKey)}`;
  return {
    claim: (sourceKey, holder) => answered(request("POST", path(sourceKey), CaptureClaim, { body: { holder } })),
    release: async (sourceKey, holder) => {
      await request("DELETE", path(sourceKey), z.unknown(), { body: { holder } });
    },
  };
};
