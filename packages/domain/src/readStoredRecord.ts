import { z } from "zod";
import type { RecordMigration } from "./RecordMigration.js";
import type { UnreadableReason } from "./UnreadableRecord.js";
import { migrateStoredRecord } from "./migrateStoredRecord.js";

export type StoredRecordRead<T> =
  | { status: "read"; record: T; schemaVersion: number }
  | { status: "unreadable"; reason: UnreadableReason; schemaVersion: number; detail: string };

// Migrate, then parse, which strips the version again (docs/features/record-migrations.md).
export const readStoredRecord = <T>(raw: unknown, schema: z.ZodType<T>, migrations: readonly RecordMigration[]): StoredRecordRead<T> => {
  const migrated = migrateStoredRecord(raw, migrations);
  if (migrated.status === "unreadable") {
    return migrated;
  }

  const parsed = schema.safeParse(migrated.record);
  if (!parsed.success) {
    return {
      status: "unreadable",
      reason: "invalid",
      schemaVersion: migrated.schemaVersion,
      detail: z.prettifyError(parsed.error),
    };
  }

  return { status: "read", record: parsed.data, schemaVersion: migrated.schemaVersion };
};
