import type { AccountId } from "../auth/AccountId.js";
import type { RecordKind } from "./RecordKind.js";
import type { RecordsRepository } from "./RecordsRepository.js";

// Run after the parent's tombstone commits, and on each retry, to catch a child written before it went.
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
