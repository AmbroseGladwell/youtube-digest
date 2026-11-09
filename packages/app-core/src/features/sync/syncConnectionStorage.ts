import { DEFAULT_SYNC_CONNECTION, libraryAccountIdOf, SyncConnection } from "./types/SyncConnection.js";

export const SYNC_CONNECTION_STORAGE_KEY = "overview.syncConnection.v1";
const STORAGE_KEY = SYNC_CONNECTION_STORAGE_KEY;

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

export function writeSyncConnection(connection: SyncConnection, storage: Storage = globalThis.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export function readLibraryAccountId(storage: Storage = globalThis.localStorage): string | null {
  return libraryAccountIdOf(readSyncConnection(storage));
}
