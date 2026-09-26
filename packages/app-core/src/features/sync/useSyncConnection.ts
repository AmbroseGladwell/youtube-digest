import { useCallback, useSyncExternalStore } from "react";
import { readSyncConnection, writeSyncConnection } from "./syncConnectionStorage.js";
import { DEFAULT_SYNC_CONNECTION, type SyncConnection } from "./types/SyncConnection.js";

export interface UseSyncConnectionResult {
  connection: SyncConnection;
  setConnection: (connection: SyncConnection) => void;
}

// One shared snapshot, as useApiKeys keeps: the settings panel writes it and the sync
// runtime, mounted above every page, has to see the write in the same tab.
const listeners = new Set<() => void>();
let snapshot: SyncConnection | null = null;

function getSnapshot(): SyncConnection {
  snapshot ??= readSyncConnection();
  return snapshot;
}

function refresh(): void {
  snapshot = readSyncConnection();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", refresh);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) globalThis.removeEventListener?.("storage", refresh);
  };
}

export function useSyncConnection(): UseSyncConnectionResult {
  const connection = useSyncExternalStore(subscribe, getSnapshot);

  const setConnection = useCallback((next: SyncConnection) => {
    writeSyncConnection(next);
    refresh();
  }, []);

  return { connection, setConnection };
}

export { DEFAULT_SYNC_CONNECTION };
