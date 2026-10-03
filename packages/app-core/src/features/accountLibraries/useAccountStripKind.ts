import { usePendingSignIn } from "../auth/usePendingSignIn.js";
import { useSync } from "../sync/SyncContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useDeviceAccountHistory } from "./useDeviceAccountHistory.js";

export type AccountStripKind = "signedOut" | "offer";

// Which strip the library carries, if any, and only once it holds something: an empty
// library is 47b after a sign-out, and the first-run page otherwise, which has one job
// already. A device that never had an account is offered one until it turns it down
// (docs/features/account-libraries.md).
export function useAccountStripKind(heldHere: number | null): AccountStripKind | null {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const { pending } = usePendingSignIn();
  const { signedOutHere, offerDismissed } = useDeviceAccountHistory();

  if (!sync.available || isConnected(connection) || pending !== null || heldHere === null || heldHere === 0) {
    return null;
  }
  if (signedOutHere) return "signedOut";
  return offerDismissed ? null : "offer";
}
