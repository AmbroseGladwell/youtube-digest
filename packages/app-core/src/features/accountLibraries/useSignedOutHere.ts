import { useSync } from "../sync/SyncContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useDeviceAccountHistory } from "./useDeviceAccountHistory.js";

// Signed out, on a device that has had an account: the state 47a, 47b and 47g describe,
// as against a reader who never signed in, for whom nothing changes.
export function useSignedOutHere(): boolean {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const { signedOutHere } = useDeviceAccountHistory();
  return sync.available && signedOutHere && !isConnected(connection);
}
