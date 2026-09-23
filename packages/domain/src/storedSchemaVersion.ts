export const SCHEMA_VERSION_KEY = "schemaVersion";

export const FIRST_SCHEMA_VERSION = 1;

export function storedSchemaVersion(record: unknown): number {
  if (typeof record !== "object" || record === null) {
    return FIRST_SCHEMA_VERSION;
  }
  const version = (record as Record<string, unknown>)[SCHEMA_VERSION_KEY];
  return typeof version === "number" ? version : FIRST_SCHEMA_VERSION;
}

export function stampSchemaVersion<T extends object>(record: T, version: number): T {
  return { ...record, [SCHEMA_VERSION_KEY]: version };
}
