import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION } from "@overview/domain";
import { ConfigError, loadConfig } from "./loadConfig.js";

const DATABASE_URL = "postgres://overview:secret@localhost:5432/overview";

test("defaults the floor to 1, the port to 3000, the session ttl to 30 days, vouches for no origin, and mails to the log", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL }), {
    databaseUrl: DATABASE_URL,
    port: 3000,
    minSupportedClientVersion: 1,
    sessionTtlDays: 30,
    allowedOrigins: [],
    appUrl: "http://localhost:5173",
    mail: { transport: "log" },
  });
});

test("real mail needs a key, a sender, and an https address for the links to point at", () => {
  const config = loadConfig({
    DATABASE_URL,
    APP_URL: "https://overview.example/",
    MAIL_TRANSPORT: "brevo",
    BREVO_API_KEY: "xkeysib-key",
    MAIL_FROM: "The Overview <signin@overview.example>",
  });
  assert.equal(config.appUrl, "https://overview.example");
  assert.deepEqual(config.mail, {
    transport: "brevo",
    brevoApiKey: "xkeysib-key",
    from: "The Overview <signin@overview.example>",
  });
});

test("real mail without a key, a sender, or an https app address is refused", () => {
  const brevo = { DATABASE_URL, APP_URL: "https://overview.example", MAIL_TRANSPORT: "brevo" };
  assert.throws(() => loadConfig({ ...brevo, MAIL_FROM: "signin@overview.example" }), ConfigError);
  assert.throws(() => loadConfig({ ...brevo, BREVO_API_KEY: "xkeysib-key" }), ConfigError);
  assert.throws(
    () =>
      loadConfig({ ...brevo, APP_URL: "http://localhost:5173", BREVO_API_KEY: "xkeysib-key", MAIL_FROM: "signin@overview.example" }),
    ConfigError,
  );
});

test("an app address that is not a URL is refused", () => {
  assert.throws(() => loadConfig({ DATABASE_URL, APP_URL: "overview.example" }), ConfigError);
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
