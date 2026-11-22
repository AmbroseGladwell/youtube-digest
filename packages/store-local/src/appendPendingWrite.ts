import type { PendingWrite } from "@overview/domain";
import { OUTBOX_STORE, SYNC_ENROLLED_KEY, SYNC_META_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

export const JOURNALLED_STORES = [OUTBOX_STORE, SYNC_META_STORE];

// docs/features/sync-client.md, "What a local write leaves behind".
export const appendPendingWrite = async (transaction: IDBTransaction, write: PendingWrite): Promise<boolean> => {
  const enrolled = await promisifyRequest(transaction.objectStore(SYNC_META_STORE).get(SYNC_ENROLLED_KEY));
  if (enrolled !== true) {
    return false;
  }
  transaction.objectStore(OUTBOX_STORE).add({ ...write, stuck: null });
  return true;
};
