export const UPDATED_AT_KEY = "updatedAt";

// Null for a record written before this existed. The rule for one is uniform rather than
// per record type — it precedes every stamped record — because a rule that is uniform
// cannot be misapplied (docs/features/sync-metadata.md).
export function storedUpdatedAt(record: unknown): string | null {
  if (typeof record !== "object" || record === null) {
    return null;
  }
  const updatedAt = (record as Record<string, unknown>)[UPDATED_AT_KEY];
  return typeof updatedAt === "string" ? updatedAt : null;
}

export function stampUpdatedAt<T extends object>(record: T, now: Date): T {
  return { ...record, [UPDATED_AT_KEY]: now.toISOString() };
}
