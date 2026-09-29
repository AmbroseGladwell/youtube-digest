import { IDBFactory } from "fake-indexeddb";
import type { OutboxEntry } from "@overview/domain";
import { OUTBOX_STORE, SYNC_ENROLLED_KEY, SYNC_META_STORE } from "./localDatabaseSchema.js";
import { openLocalDatabase } from "./openLocalDatabase.js";
import { promisifyRequest } from "./promisifyRequest.js";

export async function openTestDatabase(): Promise<IDBDatabase> {
  return openLocalDatabase({ indexedDB: new IDBFactory() });
}

export async function markEnrolled(db: IDBDatabase): Promise<void> {
  await promisifyRequest(
    db.transaction(SYNC_META_STORE, "readwrite").objectStore(SYNC_META_STORE).put(true, SYNC_ENROLLED_KEY),
  );
}

export async function openEnrolledDatabase(): Promise<IDBDatabase> {
  const db = await openTestDatabase();
  await markEnrolled(db);
  return db;
}

export function readOutbox(db: IDBDatabase): Promise<OutboxEntry[]> {
  return promisifyRequest<OutboxEntry[]>(
    db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE).getAll(),
  );
}

// The outbox without the transcript entries a saved note brings with it, for tests about
// the records themselves.
export async function readRecordOutbox(db: IDBDatabase): Promise<OutboxEntry[]> {
  return (await readOutbox(db)).filter((entry) => entry.kind !== "transcript");
}

export function readRaw<T = Record<string, unknown>>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T> {
  return promisifyRequest<T>(db.transaction(store, "readonly").objectStore(store).get(key));
}

export function putRaw(db: IDBDatabase, store: string, value: unknown, key?: IDBValidKey): Promise<unknown> {
  const objectStore = db.transaction(store, "readwrite").objectStore(store);
  return promisifyRequest(key === undefined ? objectStore.put(value) : objectStore.put(value, key));
}
