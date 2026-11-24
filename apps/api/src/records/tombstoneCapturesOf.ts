import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "./RecordsRepository.js";

export interface CapturesOf {
  id: string;
  sourceKey: string | null;
}

// An overview takes the place of its source's capture: docs/features/kept-links.md, "Becoming an overview".
export const tombstoneCapturesOf = async (
  records: RecordsRepository,
  accountId: AccountId,
  { id, sourceKey }: CapturesOf,
): Promise<number> => {
  const ofSource = sourceKey === null ? [] : await records.liveOfSources(accountId, "capture", [sourceKey]);
  const ofId = await records.readLive(accountId, "capture", [id]);
  const ids = new Set([...ofId, ...ofSource].map((capture) => capture.id));
  if (ids.size === 0) {
    return 0;
  }
  const written = await records.write(
    accountId,
    [...ids].map((captureId) => ({
      kind: "capture" as const,
      id: captureId,
      decide: (current) => (current !== null && !current.deleted ? { action: "tombstone" as const } : { action: "nothing" as const }),
    })),
  );
  return written.filter((outcome) => outcome !== null).length;
};
