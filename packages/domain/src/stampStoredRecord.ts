import { stampSchemaVersion } from "./storedSchemaVersion.js";
import { stampUpdatedAt } from "./storedUpdatedAt.js";

// The write seam. A stored record cannot carry a version without also carrying the time it
// was written, because one function produces both — where stampSchemaVersion on its own
// belongs to the migration seam, which must not date a record for having been read
// (docs/features/sync-metadata.md).
export function stampStoredRecord<T extends object>(
  record: T,
  schemaVersion: number,
  now: Date = new Date(),
): T {
  return stampUpdatedAt(stampSchemaVersion(record, schemaVersion), now);
}
