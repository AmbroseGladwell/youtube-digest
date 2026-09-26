import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION } from "@overview/domain";
import { ConfigError, loadConfig } from "./loadConfig.js";

const DATABASE_URL = "postgres://overview:secret@localhost:5432/overview";

test("defaults the floor to 1, the port to 3000, the session ttl to 30 days and vouches for no origin", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL }), {
    databaseUrl: DATABASE_URL,
    port: 3000,
    minSupportedClientVersion: 1,
    sessionTtlDays: 30,
    allowedOrigins: [],
  });
});

test("the allowed origins are a comma-separated list, with the extension's own among them", () => {
  const config = loadConfig({
    DATABASE_URL,
    CORS_ALLOWED_ORIGINS: "chrome-extension://abcdefghijklmnopabcdefghijklmnop, http://localhost:5173",
  });
  assert.deepEqual(config.allowedOrigins, [
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    "http://localhost:5173",
  ]);
});

test("an allowed origin that is a wildcard or carries a path is refused", () => {
  assert.throws(() => loadConfig({ DATABASE_URL, CORS_ALLOWED_ORIGINS: "*" }), ConfigError);
  assert.throws(
    () => loadConfig({ DATABASE_URL, CORS_ALLOWED_ORIGINS: "https://sync.example.com/api" }),
    ConfigError,
  );
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
