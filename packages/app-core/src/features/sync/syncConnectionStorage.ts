import { DEFAULT_SYNC_CONNECTION, SyncConnection } from "./types/SyncConnection.js";

const STORAGE_KEY = "overview.syncConnection.v1";

export function readSyncConnection(storage: Storage = globalThis.localStorage): SyncConnection {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SYNC_CONNECTION;
  try {
    const parsed = SyncConnection.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SYNC_CONNECTION;
  } catch {
    return DEFAULT_SYNC_CONNECTION;
  }
}

export function writeSyncConnection(
  connection: SyncConnection,
  storage: Storage = globalThis.localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(connection));
}
