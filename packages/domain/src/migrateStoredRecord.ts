import type { RecordMigration } from "./RecordMigration.js";
import type { UnreadableReason } from "./UnreadableRecord.js";
import { currentSchemaVersion } from "./currentSchemaVersion.js";
import { migrateRecord } from "./migrateRecord.js";
import { storedSchemaVersion } from "./storedSchemaVersion.js";

export type StoredRecordMigration =
  | { status: "migrated"; record: Record<string, unknown>; schemaVersion: number }
  | { status: "unreadable"; reason: UnreadableReason; schemaVersion: number; detail: string };

// A newer record is held back: stripping unknown fields loses data (docs/features/record-migrations.md).
export const migrateStoredRecord = (raw: unknown, migrations: readonly RecordMigration[]): StoredRecordMigration => {
  const schemaVersion = storedSchemaVersion(raw);

  if (schemaVersion > currentSchemaVersion(migrations)) {
    return {
      status: "unreadable",
      reason: "future-version",
      schemaVersion,
      detail: "written by a newer version of the app than this one can read",
    };
  }

  let migrated: unknown;
  try {
    migrated = migrateRecord(raw, migrations);
  } catch (error) {
    return {
      status: "unreadable",
      reason: "unmigratable",
      schemaVersion,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof migrated !== "object" || migrated === null) {
    return {
      status: "unreadable",
      reason: "invalid",
      schemaVersion,
      detail: "the stored record is not an object",
    };
  }

  return { status: "migrated", record: migrated as Record<string, unknown>, schemaVersion };
};
