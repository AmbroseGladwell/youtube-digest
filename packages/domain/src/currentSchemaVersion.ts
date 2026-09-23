import { FIRST_SCHEMA_VERSION } from "./storedSchemaVersion.js";
import type { RecordMigration } from "./RecordMigration.js";

// The registry is the version number: there is no separate constant to drift from it.
export function currentSchemaVersion(migrations: readonly RecordMigration[]): number {
  return migrations.at(-1)?.newSchemaVersion ?? FIRST_SCHEMA_VERSION;
}
