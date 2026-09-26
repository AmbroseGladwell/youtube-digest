import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CURRENT_SCHEMA_VERSIONS, schemaVersionsForClient } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { assertWholeRecordVersion } from "./assertWholeRecordVersion.js";

const current = { version: CLIENT_VERSION, schemaVersions: schemaVersionsForClient(CLIENT_VERSION) };
const CURRENT = CURRENT_SCHEMA_VERSIONS.overview;

test("a body at the client's own version for the kind is accepted", () => {
  assert.doesNotThrow(() => assertWholeRecordVersion("overview", CURRENT, current));
});

test("a body below the client's own version is refused: a client never writes at an older version than itself", () => {
  assert.throws(() => assertWholeRecordVersion("overview", CURRENT - 1, current), ApiError);
});

test("a body above the client's own version is refused when the table knows that client", () => {
  const older = { version: CLIENT_VERSION, schemaVersions: { ...current.schemaVersions, overview: CURRENT - 1 } };
  assert.throws(() => assertWholeRecordVersion("overview", CURRENT, older), ApiError);
});

test("a client above the table may write at any version from the server's current upwards", () => {
  const newer = { version: CLIENT_VERSION + 5, schemaVersions: schemaVersionsForClient(CLIENT_VERSION + 5) };
  assert.doesNotThrow(() => assertWholeRecordVersion("overview", CURRENT, newer));
  assert.doesNotThrow(() => assertWholeRecordVersion("overview", CURRENT + 3, newer));
  assert.throws(() => assertWholeRecordVersion("overview", CURRENT - 1, newer), ApiError);
});
