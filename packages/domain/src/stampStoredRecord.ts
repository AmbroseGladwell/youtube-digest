import { stampSchemaVersion } from "./storedSchemaVersion.js";
import { stampUpdatedAt } from "./storedUpdatedAt.js";

// The write seam: version and write time come together (docs/features/sync-metadata.md).
export const stampStoredRecord = <T extends object>(record: T, schemaVersion: number, now: Date = new Date()): T => {
  return stampUpdatedAt(stampSchemaVersion(record, schemaVersion), now);
};
