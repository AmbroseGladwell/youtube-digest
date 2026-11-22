import { useSync } from "../sync/SyncContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

// A shell with no server has no account to offer: docs/architecture/tiers.md, "Signed out".
export const useAccountNeeded = (): boolean => {
  const sync = useSync();
  const { connection } = useSyncConnection();
  return sync.available && !isConnected(connection);
};
