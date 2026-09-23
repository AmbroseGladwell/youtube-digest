import { z } from "zod";
import type { RecordMigration } from "./RecordMigration.js";
import type { UnreadableReason } from "./UnreadableRecord.js";
import { migrateStoredRecord } from "./migrateStoredRecord.js";

export type StoredRecordRead<T> =
  | { status: "read"; record: T; schemaVersion: number }
  | { status: "unreadable"; reason: UnreadableReason; schemaVersion: number; detail: string };

// The one path every record takes, wherever it came from: migrate, then parse. The parse
// is also what removes the version again, because zod objects strip unknown keys
// (docs/features/record-migrations.md).
export function readStoredRecord<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  migrations: readonly RecordMigration[],
): StoredRecordRead<T> {
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
}
