import { usePendingSignIn } from "../auth/usePendingSignIn.js";
import { useSync } from "../sync/SyncContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useDeviceAccountHistory } from "./useDeviceAccountHistory.js";

export type AccountStripKind = "signedOut" | "offer";

// Which strip the library carries, if any. A device that has signed out says so while it
// holds something (an empty one is 47b instead); one that never has offers an account
// until turned down (docs/features/account-libraries.md).
export function useAccountStripKind(heldHere: number | null): AccountStripKind | null {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const { pending } = usePendingSignIn();
  const { signedOutHere, offerDismissed } = useDeviceAccountHistory();

  if (!sync.available || isConnected(connection) || pending !== null || heldHere === null) return null;
  if (signedOutHere) return heldHere > 0 ? "signedOut" : null;
  return offerDismissed ? null : "offer";
}
