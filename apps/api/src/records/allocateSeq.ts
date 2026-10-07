import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

// The allocator and the lock are one statement: it row-locks the account for the rest of
// the transaction, so one account's writes commit in seq order (docs/features/sync-api.md).
export async function allocateSeq(tx: SqlClient, accountId: AccountId): Promise<number> {
  const rows = await tx.query<{ last_seq: number | string | bigint }>(
    "update accounts set last_seq = last_seq + 1 where id = $1 returning last_seq",
    [accountId],
  );
  return Number(rows[0]!.last_seq);
}
