import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION } from "@overview/domain";
import { ConfigError, loadConfig } from "./loadConfig.js";

const DATABASE_URL = "postgres://overview:secret@localhost:5432/overview";

test("defaults the floor to 1, the port to 3000, the session ttl to 30 days, vouches for no origin, mails to the log, trusts the socket's address, narrates nothing, reads no playlists, and forwards no analytics", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL }), {
    databaseUrl: DATABASE_URL,
    port: 3000,
    minSupportedClientVersion: 1,
    sessionTtlDays: 30,
    allowedOrigins: [],
    appUrl: "http://localhost:5173",
    mail: { transport: "log" },
    staticRoot: null,
    clientIpHeader: null,
    audio: null,
    transcriptService: null,
    youTubeApiKey: null,
    analytics: { environment: "development", postHog: null },
    logs: null,
  });
});

test("playlists are read only with a YouTube Data API key", () => {
  assert.equal(loadConfig({ DATABASE_URL, YOUTUBE_API_KEY: "AIza-test" }).youTubeApiKey, "AIza-test");
});

test("our own server fetches transcripts only when switched on, through the proxy only when one is named", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL, TRANSCRIPT_SERVICE: "on" }).transcriptService, {
    proxyUrl: null,
    proxyDailyFetches: 1000,
  });
  assert.deepEqual(
    loadConfig({
      DATABASE_URL,
      TRANSCRIPT_SERVICE: "on",
      TRANSCRIPT_PROXY_URL: "http://user-{session}:pass@gate.example.com:7000",
      TRANSCRIPT_PROXY_DAILY_FETCHES: "300",
    }).transcriptService,
    { proxyUrl: "http://user-{session}:pass@gate.example.com:7000", proxyDailyFetches: 300 },
  );
  assert.equal(
    loadConfig({ DATABASE_URL, TRANSCRIPT_PROXY_URL: "http://user:pass@gate.example.com:7000" }).transcriptService,
    null,
  );
  assert.throws(() => loadConfig({ DATABASE_URL, TRANSCRIPT_PROXY_URL: "socks5://gate.example.com:7000" }), ConfigError);
});

test("logs are shipped to PostHog under the analytics key, and a bad OTEL variable stops the server starting", () => {
  assert.equal(loadConfig({ DATABASE_URL, POSTHOG_API_KEY: "phc_test" }).logs?.endpoint, "https://eu.i.posthog.com/i/v1/logs");
  assert.throws(() => loadConfig({ DATABASE_URL, OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "grpc" }), ConfigError);
});

test("analytics are forwarded to PostHog's EU host once there is a project key, tagged with the environment", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL, POSTHOG_API_KEY: "phc_test", ANALYTICS_ENVIRONMENT: "production" }).analytics, {
    environment: "production",
    postHog: { apiKey: "phc_test", host: "https://eu.i.posthog.com" },
  });
  assert.throws(() => loadConfig({ DATABASE_URL, ANALYTICS_ENVIRONMENT: "staging" }), ConfigError);
});

test("the header naming the caller's address is read in any case, and anything that is not a header name is refused", () => {
  assert.equal(loadConfig({ DATABASE_URL, CLIENT_IP_HEADER: "Fly-Client-IP" }).clientIpHeader, "fly-client-ip");
  assert.throws(() => loadConfig({ DATABASE_URL, CLIENT_IP_HEADER: "fly-client-ip: 1.2.3.4" }), ConfigError);
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

test("serves no web app unless told where one is", () => {
  assert.equal(loadConfig({ DATABASE_URL, STATIC_ROOT: "/srv/web" }).staticRoot, "/srv/web");
});

const R2 = {
  R2_ACCOUNT_ID: "781691f32a5cf03b132121e499f510a4",
  R2_BUCKET: "the-overview-audio-dev",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
};

test("narrates through the TTS service it is given into R2, five renders at a time unless told otherwise", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL, TTS_URL: "http://localhost:8000", ...R2 }).audio, {
    ttsUrl: "http://localhost:8000",
    concurrency: 5,
    store: {
      kind: "r2",
      accountId: R2.R2_ACCOUNT_ID,
      bucket: R2.R2_BUCKET,
      accessKeyId: R2.R2_ACCESS_KEY_ID,
      secretAccessKey: R2.R2_SECRET_ACCESS_KEY,
    },
  });
});

test("keeps narration in a directory when there is no R2, and prefers R2 when there is both", () => {
  const tts = { DATABASE_URL, TTS_URL: "http://localhost:8000", AUDIO_DIR: ".local/audio" };

  assert.deepEqual(loadConfig(tts).audio?.store, { kind: "file", dir: ".local/audio" });
  assert.equal(loadConfig({ ...tts, ...R2 }).audio?.store.kind, "r2");
});

test("refuses a TTS service with nowhere to keep what it renders, and a bucket without its keys", () => {
  assert.throws(() => loadConfig({ DATABASE_URL, TTS_URL: "http://localhost:8000" }), ConfigError);
  assert.throws(() => loadConfig({ DATABASE_URL, R2_BUCKET: "the-overview-audio-dev" }), ConfigError);
});

test("R2 keys imported ahead of the bucket they are for are held, not refused", () => {
  const { R2_BUCKET, ...keysOnly } = R2;

  assert.equal(loadConfig({ DATABASE_URL, ...keysOnly }).audio, null);
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
