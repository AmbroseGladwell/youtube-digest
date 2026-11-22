import { useCallback, useSyncExternalStore } from "react";
import { readSyncConnection, writeSyncConnection } from "./syncConnectionStorage.js";
import { DEFAULT_SYNC_CONNECTION, type SyncConnection } from "./types/SyncConnection.js";

export interface UseSyncConnectionResult {
  connection: SyncConnection;
  setConnection: (connection: SyncConnection) => void;
}

// Shared, so the sync runtime above every page sees the settings panel's write in the same tab.
const listeners = new Set<() => void>();
let snapshot: SyncConnection | null = null;

const getSnapshot = (): SyncConnection => {
  snapshot ??= readSyncConnection();
  return snapshot;
};

const refresh = (): void => {
  snapshot = readSyncConnection();
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", refresh);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      globalThis.removeEventListener?.("storage", refresh);
    }
  };
};

export const useSyncConnection = (): UseSyncConnectionResult => {
  const connection = useSyncExternalStore(subscribe, getSnapshot);

  const setConnection = useCallback((next: SyncConnection) => {
    writeSyncConnection(next);
    refresh();
  }, []);

  return { connection, setConnection };
};

export { DEFAULT_SYNC_CONNECTION };
