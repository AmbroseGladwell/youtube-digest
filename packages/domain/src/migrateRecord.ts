import type { RecordMigration } from "./RecordMigration.js";
import { RecordMigrationError } from "./RecordMigrationError.js";
import { stampSchemaVersion, storedSchemaVersion } from "./storedSchemaVersion.js";

export function applyRecordMigration(record: unknown, migration: RecordMigration): unknown {
  const expected = migration.newSchemaVersion - 1;
  const found = storedSchemaVersion(record);
  if (found !== expected) {
    throw new RecordMigrationError(expected, found);
  }

  const altered = migration.alterRecord ? migration.alterRecord(record) : record;
  if (typeof altered !== "object" || altered === null) {
    throw new RecordMigrationError(expected, found);
  }
  return stampSchemaVersion(altered, migration.newSchemaVersion);
}

export function migrateRecord(record: unknown, migrations: readonly RecordMigration[]): unknown {
  let migrated = record;
  for (const migration of migrations) {
    if (storedSchemaVersion(migrated) >= migration.newSchemaVersion) {
      continue;
    }
    migrated = applyRecordMigration(migrated, migration);
  }
  return migrated;
}
