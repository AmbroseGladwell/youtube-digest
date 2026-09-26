import { CURRENT_OVERVIEW_SCHEMA_VERSION } from "./overviewMigrations.js";
import { CURRENT_OVERVIEW_STATE_SCHEMA_VERSION } from "./overviewStateMigrations.js";
import { CURRENT_SETTINGS_SCHEMA_VERSION } from "./settingsMigrations.js";
import { CURRENT_TOPIC_SCHEMA_VERSION } from "./topicMigrations.js";
import type { UnreadableRecordKind } from "./UnreadableRecord.js";

export type SyncedRecordKind = UnreadableRecordKind;

export const SYNCED_RECORD_KINDS: readonly SyncedRecordKind[] = [
  "overview",
  "overviewState",
  "topic",
  "settings",
];

export type SchemaVersions = Record<SyncedRecordKind, number>;

export const CURRENT_SCHEMA_VERSIONS: SchemaVersions = {
  overview: CURRENT_OVERVIEW_SCHEMA_VERSION,
  overviewState: CURRENT_OVERVIEW_STATE_SCHEMA_VERSION,
  topic: CURRENT_TOPIC_SCHEMA_VERSION,
  settings: CURRENT_SETTINGS_SCHEMA_VERSION,
};
