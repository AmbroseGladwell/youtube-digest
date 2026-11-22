import type { SyncPhase } from "./SyncStatus.js";
import { isSyncRequestError, isSyncTransportError } from "./SyncRequestError.js";

export type StopReason = Extract<SyncPhase, "offline" | "failed" | "signedOut" | "unsupported">;

// A failure that ends the cycle, not the write: nothing later in the outbox would fare better.
export const stopReasonFor = (error: unknown): StopReason | null => {
  if (isSyncTransportError(error)) {
    return "offline";
  }
  if (!isSyncRequestError(error)) {
    return "failed";
  }
  switch (error.code) {
    case "unauthenticated":
      return "signedOut";
    case "client_unsupported":
      return "unsupported";
    case "internal_error":
    case "unavailable":
    case "too_many_requests":
      return "failed";
    default:
      return null;
  }
};

export const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));
