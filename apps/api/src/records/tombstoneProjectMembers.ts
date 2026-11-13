import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "./RecordsRepository.js";

export type MembersOf = { projectId: string } | { overviewId: string };

const patternFor = (of: MembersOf): string => ("projectId" in of ? `${of.projectId}:%` : `%:${of.overviewId}`);

// Run after the parent's tombstone has committed, and on every retry of it, so a membership record added
// before the parent went is caught and none can be added after (docs/features/projects.md).
export async function tombstoneProjectMembers(records: RecordsRepository, accountId: AccountId, of: MembersOf): Promise<number> {
  const ids = await records.listLiveIds(accountId, "projectMember", patternFor(of));
  if (ids.length === 0) return 0;
  const written = await records.write(
    accountId,
    ids.map((id) => ({
      kind: "projectMember" as const,
      id,
      decide: (current) => (current !== null && !current.deleted ? { action: "tombstone" as const } : { action: "nothing" as const }),
    })),
  );
  return written.filter((outcome) => outcome !== null).length;
}
