// alterRecord is absent for a purely additive bump (docs/features/record-migrations.md).
export interface RecordMigration {
  newSchemaVersion: number;
  alterRecord?: (record: unknown) => unknown;
}
