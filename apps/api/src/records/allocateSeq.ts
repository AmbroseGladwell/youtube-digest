import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

// Why: docs/features/sync-api.md, "The seq is a per-account counter, and the update that allocates it is the lock".
export const allocateSeq = async (tx: SqlClient, accountId: AccountId): Promise<number> => {
  const rows = await tx.query<{ last_seq: number | string | bigint }>(
    "update accounts set last_seq = last_seq + 1 where id = $1 returning last_seq",
    [accountId],
  );
  return Number(rows[0]!.last_seq);
};
