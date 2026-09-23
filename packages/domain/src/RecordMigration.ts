// One step forward along a record type's chain. alterRecord is absent for a purely
// additive bump, which still moves the number: whether the version moved and whether any
// record needed changing are separate questions (docs/features/record-migrations.md).
export interface RecordMigration {
  newSchemaVersion: number;
  alterRecord?: (record: unknown) => unknown;
}
