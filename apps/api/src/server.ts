import pg from "pg";
import { createAudioSetup } from "./audio/createAudioSetup.js";
import { buildApp } from "./buildApp.js";
import { createPgSqlClient } from "./db/createPgSqlClient.js";
import { runMigrations } from "./db/runMigrations.js";
import { ConfigError, loadConfig } from "./loadConfig.js";
import { createPostHogErrorSink } from "./errors/postHogErrorSink.js";
import { createPostHogEventSink } from "./events/postHogEventSink.js";
import { createLogger } from "./logs/createLogger.js";
import { OtlpLogExporter } from "./logs/OtlpLogExporter.js";
import { createMailer } from "./mail/createMailer.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof ConfigError ? `configuration: ${error.message}` : error);
  process.exit(1);
}

const sql = createPgSqlClient(new pg.Pool({ connectionString: config.databaseUrl }));
const applied = await runMigrations(sql);
const audio = config.audio === null ? null : createAudioSetup(config.audio, true);
const { postHog, environment } = config.analytics;
const eventSink = postHog === null ? null : createPostHogEventSink({ ...postHog, environment });
const errorSink = postHog === null ? null : createPostHogErrorSink({ ...postHog, environment });
const logExporter =
  config.logs === null
    ? null
    : new OtlpLogExporter({
        ...config.logs,
        onFailure: (error) =>
          process.stderr.write(`${JSON.stringify({ level: 40, time: Date.now(), msg: "logs not shipped", error })}\n`),
      });
const logger = createLogger(logExporter === null ? [process.stdout] : [process.stdout, logExporter]);
const app = await buildApp({ config, sql, mailer: createMailer(config.mail), audio, eventSink, errorSink, logger });
app.log.info({ applied }, "migrations applied");
app.log.info({ transport: config.mail.transport, appUrl: config.appUrl }, "magic links");
app.log.info(
  config.audio === null
    ? "TTS_URL is not set: narration is unavailable"
    : {
        tts: config.audio.ttsUrl,
        store: config.audio.store.kind === "r2" ? `r2:${config.audio.store.bucket}` : config.audio.store.dir,
      },
  "narration",
);
app.log.info(
  postHog === null ? "POSTHOG_API_KEY is not set: client events and errors are logged only" : { host: postHog.host, environment },
  "analytics",
);
app.log.info(
  config.staticRoot === null ? "STATIC_ROOT is not set: serving the API only" : { root: config.staticRoot },
  "web app",
);
app.log.info(
  config.logs === null ? "no OTLP logs endpoint: logs go to stdout only" : { endpoint: new URL(config.logs.endpoint).origin },
  "log shipping",
);

// Fly stops an idle machine with SIGINT; the last lines are shipped before it goes.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app
      .close()
      .then(() => logExporter?.close())
      .finally(() => process.exit(0));
  });
}

await app.listen({ port: config.port, host: "0.0.0.0" });
