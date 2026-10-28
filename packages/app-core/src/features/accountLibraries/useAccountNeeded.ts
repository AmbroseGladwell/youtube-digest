import { useSync } from "../sync/SyncContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

// Signed out where this shell can make an account: no overview is made or seen until there
// is one (docs/architecture/tiers.md, "Signed out"). A shell with no server has no account
// to offer, and keeps its library on the device as before.
export function useAccountNeeded(): boolean {
  const sync = useSync();
  const { connection } = useSyncConnection();
  return sync.available && !isConnected(connection);
}
