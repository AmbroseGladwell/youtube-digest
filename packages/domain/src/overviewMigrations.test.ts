import test from "node:test";
import assert from "node:assert/strict";
import { Overview } from "./Overview.js";
import { OVERVIEW_CORPUS } from "./overviewCorpus.js";
import { CURRENT_OVERVIEW_SCHEMA_VERSION, OVERVIEW_MIGRATIONS } from "./overviewMigrations.js";
import { applyRecordMigration, migrateRecord } from "./migrateRecord.js";
import { RecordMigrationError } from "./RecordMigrationError.js";
import { FIRST_SCHEMA_VERSION, storedSchemaVersion } from "./storedSchemaVersion.js";

const corpusAt = (version: number): unknown => {
  const record = OVERVIEW_CORPUS.get(version);
  assert.ok(record !== undefined, `no corpus record at version ${version}`);
  return record;
};

test("the registry is a contiguous chain from the first version", () => {
  const versions = OVERVIEW_MIGRATIONS.map((migration) => migration.newSchemaVersion);
  assert.deepEqual(
    versions,
    versions.map((_, index) => FIRST_SCHEMA_VERSION + index + 1),
  );
});

test("registering a migration without its corpus records fails here rather than in a user's library", () => {
  for (const migration of OVERVIEW_MIGRATIONS) {
    assert.ok(
      OVERVIEW_CORPUS.has(migration.newSchemaVersion - 1),
      `version ${migration.newSchemaVersion - 1} has no corpus record`,
    );
    assert.ok(
      OVERVIEW_CORPUS.has(migration.newSchemaVersion),
      `version ${migration.newSchemaVersion} has no corpus record`,
    );
  }
  assert.deepEqual(
    [...OVERVIEW_CORPUS.keys()].sort((a, b) => a - b),
    Array.from({ length: CURRENT_OVERVIEW_SCHEMA_VERSION }, (_, index) => index + 1),
  );
});

test("each migration turns the corpus record below it into the corpus record at its own version", () => {
  for (const migration of OVERVIEW_MIGRATIONS) {
    assert.deepEqual(
      applyRecordMigration(corpusAt(migration.newSchemaVersion - 1), migration),
      corpusAt(migration.newSchemaVersion),
      `migration to version ${migration.newSchemaVersion}`,
    );
  }
});

test("the whole chain carries the oldest record to the current one", () => {
  assert.deepEqual(
    migrateRecord(corpusAt(FIRST_SCHEMA_VERSION), OVERVIEW_MIGRATIONS),
    corpusAt(CURRENT_OVERVIEW_SCHEMA_VERSION),
  );
});

test("the record at the current version is an Overview", () => {
  assert.doesNotThrow(() => Overview.parse(corpusAt(CURRENT_OVERVIEW_SCHEMA_VERSION)));
});

test("a record written before the version existed counts as the first version", () => {
  assert.equal(storedSchemaVersion(corpusAt(FIRST_SCHEMA_VERSION)), FIRST_SCHEMA_VERSION);
});

test("parsing removes the version again, so domain code never sees it", () => {
  const parsed = Overview.parse(corpusAt(CURRENT_OVERVIEW_SCHEMA_VERSION));
  assert.equal("schemaVersion" in parsed, false);
});

test("a migration refuses a record that is not at exactly the version below it", () => {
  for (const migration of OVERVIEW_MIGRATIONS) {
    assert.throws(
      () => applyRecordMigration(corpusAt(migration.newSchemaVersion), migration),
      RecordMigrationError,
    );
  }
});

test("migrating an already-current record changes nothing", () => {
  const current = corpusAt(CURRENT_OVERVIEW_SCHEMA_VERSION);
  assert.deepEqual(migrateRecord(current, OVERVIEW_MIGRATIONS), current);
});

test("a record from before chapters existed reads with chapters null, which the chapters tab reports", () => {
  const migrated = migrateRecord(corpusAt(FIRST_SCHEMA_VERSION), OVERVIEW_MIGRATIONS) as Record<string, unknown>;
  assert.ok("chapters" in migrated);
  assert.equal(migrated.chapters, null);
  assert.equal(Overview.parse(migrated).chapters, null);
});

test("the filled video fields are null rather than absent, which is what every reader guards on", () => {
  const migrated = migrateRecord(corpusAt(FIRST_SCHEMA_VERSION), OVERVIEW_MIGRATIONS) as {
    video: Record<string, unknown>;
  };
  for (const field of ["durationMs", "publishedAt", "thumbnailUrl"]) {
    assert.ok(field in migrated.video, `${field} is absent`);
    assert.equal(migrated.video[field], null);
  }
});
