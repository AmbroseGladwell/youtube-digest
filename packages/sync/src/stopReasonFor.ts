import type { SyncPhase } from "./SyncStatus.js";
import { isSyncRequestError, isSyncTransportError } from "./SyncRequestError.js";

export type StopReason = Extract<SyncPhase, "offline" | "failed" | "signedOut" | "unsupported">;

// A failure that ends the cycle rather than the one write: nothing later in the outbox
// would fare any better, and a retry later might. Anything else is the write's own fault
// and is parked (docs/features/sync-client.md).
export function stopReasonFor(error: unknown): StopReason | null {
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
      return "failed";
    default:
      return null;
  }
}

export const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
