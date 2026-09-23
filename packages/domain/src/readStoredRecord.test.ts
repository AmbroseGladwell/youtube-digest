import test from "node:test";
import assert from "node:assert/strict";
import { Overview } from "./Overview.js";
import { OVERVIEW_CORPUS } from "./overviewCorpus.js";
import { CURRENT_OVERVIEW_SCHEMA_VERSION, OVERVIEW_MIGRATIONS } from "./overviewMigrations.js";
import { readStoredRecord } from "./readStoredRecord.js";

const version1 = OVERVIEW_CORPUS.get(1) as Record<string, unknown>;

test("a record written by an older schema is migrated and then read", () => {
  const read = readStoredRecord(version1, Overview, OVERVIEW_MIGRATIONS);
  assert.equal(read.status, "read");
  assert.equal(read.status === "read" && read.record.video.durationMs, null);
});

test("a record written by a newer schema is held back rather than read loosely", () => {
  const read = readStoredRecord(
    { ...version1, schemaVersion: CURRENT_OVERVIEW_SCHEMA_VERSION + 1 },
    Overview,
    OVERVIEW_MIGRATIONS,
  );
  assert.equal(read.status, "unreadable");
  assert.equal(read.status === "unreadable" && read.reason, "future-version");
  assert.equal(read.schemaVersion, CURRENT_OVERVIEW_SCHEMA_VERSION + 1);
});

test("a record the chain cannot reach is quarantined, not thrown out", () => {
  const read = readStoredRecord(version1, Overview, [{ newSchemaVersion: 3 }]);
  assert.equal(read.status, "unreadable");
  assert.equal(read.status === "unreadable" && read.reason, "unmigratable");
});

test("a record that migrates but does not parse is quarantined with the parse failure on it", () => {
  const read = readStoredRecord(
    { ...version1, coreClaim: 7 },
    Overview,
    OVERVIEW_MIGRATIONS,
  );
  assert.equal(read.status, "unreadable");
  assert.equal(read.status === "unreadable" && read.reason, "invalid");
  assert.match(read.status === "unreadable" ? read.detail : "", /coreClaim/);
});

test("an invariant the migration output breaks is a quarantine rather than a corrupt record", () => {
  const read = readStoredRecord(
    { ...version1, thin: true },
    Overview,
    OVERVIEW_MIGRATIONS,
  );
  assert.equal(read.status, "unreadable");
  assert.equal(read.status === "unreadable" && read.reason, "invalid");
});
