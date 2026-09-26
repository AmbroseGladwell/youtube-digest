import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION } from "@overview/domain";
import { ConfigError, loadConfig } from "./loadConfig.js";

const DATABASE_URL = "postgres://overview:secret@localhost:5432/overview";

test("defaults the floor to 1, the port to 3000 and the session ttl to 30 days", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL }), {
    databaseUrl: DATABASE_URL,
    port: 3000,
    minSupportedClientVersion: 1,
    sessionTtlDays: 30,
  });
});

test("refuses to start without a database", () => {
  assert.throws(() => loadConfig({}), ConfigError);
});

test("refuses a floor above the server's own client version", () => {
  assert.throws(
    () => loadConfig({ DATABASE_URL, MIN_SUPPORTED_CLIENT_VERSION: String(CLIENT_VERSION + 1) }),
    ConfigError,
  );
});

test("a floor that is not a whole number is refused", () => {
  assert.throws(() => loadConfig({ DATABASE_URL, MIN_SUPPORTED_CLIENT_VERSION: "1.5" }), ConfigError);
});
