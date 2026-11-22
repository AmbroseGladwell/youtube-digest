import type { AccountId } from "../auth/AccountId.js";
import type { RecordKind } from "./RecordKind.js";
import type { RecordsRepository } from "./RecordsRepository.js";

// Every live record of one kind whose id matches a pattern in SQL's LIKE syntax. Run after a
// parent's tombstone has committed, and on every retry of it, so a child written before the
// parent went is caught; a child's own write refuses a parent that is gone, so none can follow.
export const tombstoneLiveRecords = async (
  records: RecordsRepository,
  accountId: AccountId,
  kind: RecordKind,
  idPattern: string,
): Promise<number> => {
  const ids = await records.listLiveIds(accountId, kind, idPattern);
  if (ids.length === 0) {
    return 0;
  }
  const written = await records.write(
    accountId,
    ids.map((id) => ({
      kind,
      id,
      decide: (current) => (current !== null && !current.deleted ? { action: "tombstone" as const } : { action: "nothing" as const }),
    })),
  );
  return written.filter((outcome) => outcome !== null).length;
};
