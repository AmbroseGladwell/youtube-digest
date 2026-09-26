import type { PendingWrite } from "@overview/domain";
import { OUTBOX_STORE, SYNC_ENROLLED_KEY, SYNC_META_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

export const JOURNALLED_STORES = [OUTBOX_STORE, SYNC_META_STORE];

// Whether a write is journaled is a fact about the database, not about which store
// class wrote it: an enrolled library journals every write, in the same transaction as
// the write, and a library that was never enrolled journals nothing
// (docs/features/sync-client.md).
export async function appendPendingWrite(transaction: IDBTransaction, write: PendingWrite): Promise<boolean> {
  const enrolled = await promisifyRequest(transaction.objectStore(SYNC_META_STORE).get(SYNC_ENROLLED_KEY));
  if (enrolled !== true) {
    return false;
  }
  transaction.objectStore(OUTBOX_STORE).add({ ...write, stuck: null });
  return true;
}
