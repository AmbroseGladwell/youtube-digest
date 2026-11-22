export const UPDATED_AT_KEY = "updatedAt";

// Null for older records, by one uniform rule (docs/features/sync-metadata.md).
export const storedUpdatedAt = (record: unknown): string | null => {
  if (typeof record !== "object" || record === null) {
    return null;
  }
  const updatedAt = (record as Record<string, unknown>)[UPDATED_AT_KEY];
  return typeof updatedAt === "string" ? updatedAt : null;
};

export const stampUpdatedAt = <T extends object>(record: T, now: Date): T => {
  return { ...record, [UPDATED_AT_KEY]: now.toISOString() };
};
