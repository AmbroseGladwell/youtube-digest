import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CURRENT_SCHEMA_VERSIONS, schemaVersionsForClient } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { assertRecordWritable } from "./assertRecordWritable.js";

const client = { version: CLIENT_VERSION, schemaVersions: schemaVersionsForClient(CLIENT_VERSION) };

test("a record at or below the caller's version for its kind is writable", () => {
  assert.doesNotThrow(() => assertRecordWritable("overview", CURRENT_SCHEMA_VERSIONS.overview, client));
  assert.doesNotThrow(() => assertRecordWritable("overview", 1, client));
});

test("a record above the caller's version for its kind is refused naming the kind and both versions", () => {
  assert.throws(
    () => assertRecordWritable("overview", CURRENT_SCHEMA_VERSIONS.overview + 1, client),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "record_newer_than_client" &&
      error.details?.kind === "overview" &&
      error.details?.storedSchemaVersion === CURRENT_SCHEMA_VERSIONS.overview + 1 &&
      error.details?.clientSchemaVersion === CURRENT_SCHEMA_VERSIONS.overview,
  );
});
