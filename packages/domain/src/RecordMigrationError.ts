export class RecordMigrationError extends Error {
  readonly expectedSchemaVersion: number;
  readonly foundSchemaVersion: number;

  constructor(expectedSchemaVersion: number, foundSchemaVersion: number) {
    super(
      `a migration to version ${expectedSchemaVersion + 1} was given a record at version ${foundSchemaVersion}`,
    );
    this.name = "RecordMigrationError";
    this.expectedSchemaVersion = expectedSchemaVersion;
    this.foundSchemaVersion = foundSchemaVersion;
  }
}
