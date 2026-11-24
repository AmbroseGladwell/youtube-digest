import type { SourceKey } from "@overview/domain";
import { isSyncRequestError, type CaptureClaimApi } from "@overview/sync";

export type ClaimAnswer = { made: "here" } | { made: "elsewhere"; until: number };

// Only another device's claim holds a video back; any other failure makes it here (docs/features/capture-queue.md).
export const claimOrSkip = async (api: CaptureClaimApi | null, sourceKey: SourceKey, holder: string): Promise<ClaimAnswer> => {
  if (api === null) {
    return { made: "here" };
  }
  try {
    await api.claim(sourceKey, holder);
    return { made: "here" };
  } catch (error) {
    const until = isSyncRequestError(error) && error.code === "claimed_elsewhere" ? Date.parse(String(error.details?.until)) : NaN;
    return Number.isFinite(until) ? { made: "elsewhere", until } : { made: "here" };
  }
};
