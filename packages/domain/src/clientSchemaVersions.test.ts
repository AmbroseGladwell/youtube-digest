import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION } from "./clientVersion.js";
import { CLIENT_SCHEMA_VERSIONS, schemaVersionsForClient } from "./clientSchemaVersions.js";
import { CURRENT_SCHEMA_VERSIONS, SYNCED_RECORD_KINDS } from "./SchemaVersions.js";

test("the row for the current client version matches the registries, so a registry cannot move without a new row", () => {
  assert.deepEqual(schemaVersionsForClient(CLIENT_VERSION), CURRENT_SCHEMA_VERSIONS);
});

test("CLIENT_VERSION is the last row of the table", () => {
  assert.equal(CLIENT_SCHEMA_VERSIONS.at(-1)?.clientVersion, CLIENT_VERSION);
});

test("rows rise with the client version and no kind ever goes backwards", () => {
  CLIENT_SCHEMA_VERSIONS.forEach((row, index) => {
    const previous = CLIENT_SCHEMA_VERSIONS[index - 1];
    if (previous === undefined) {
      return;
    }
    assert.ok(row.clientVersion > previous.clientVersion);
    for (const kind of SYNCED_RECORD_KINDS) {
      assert.ok(row.schemaVersions[kind] >= previous.schemaVersions[kind], kind);
    }
  });
});

test("a client version above the table is treated as knowing the last row", () => {
  assert.deepEqual(schemaVersionsForClient(CLIENT_VERSION + 10), CURRENT_SCHEMA_VERSIONS);
});

test("a client version below the first row is treated as the first row rather than as nothing", () => {
  assert.deepEqual(schemaVersionsForClient(0), CLIENT_SCHEMA_VERSIONS[0]!.schemaVersions);
});
