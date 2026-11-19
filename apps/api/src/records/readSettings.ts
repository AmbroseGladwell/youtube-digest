import { DEFAULT_SETTINGS, readStoredRecord, SETTINGS_MIGRATIONS, Settings, stampSchemaVersion } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { SETTINGS_RECORD_ID } from "./RecordKind.js";
import type { RecordsRepository } from "./RecordsRepository.js";

export async function readSettings(records: RecordsRepository, accountId: AccountId): Promise<Settings | null> {
  const stored = await records.read(accountId, "settings", SETTINGS_RECORD_ID);
  if (stored === null || stored.deleted || stored.body === null) {
    return DEFAULT_SETTINGS;
  }
  const read = readStoredRecord(stampSchemaVersion(stored.body, stored.schemaVersion), Settings, SETTINGS_MIGRATIONS);
  return read.status === "read" ? read.record : null;
}
