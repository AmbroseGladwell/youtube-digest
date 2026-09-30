import pg from "pg";
import { createFileAudioStore } from "./audio/fileAudioStore.js";
import { createHttpNarrator } from "./audio/httpNarrator.js";
import { buildApp } from "./buildApp.js";
import { createPgSqlClient } from "./db/createPgSqlClient.js";
import { runMigrations } from "./db/runMigrations.js";
import { ConfigError, loadConfig } from "./loadConfig.js";
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
const audio =
  config.audio === null
    ? null
    : {
        narrator: createHttpNarrator(config.audio.ttsUrl),
        store: createFileAudioStore(config.audio.audioDir),
        concurrency: config.audio.concurrency,
        runWorkers: true,
      };
const app = await buildApp({ config, sql, mailer: createMailer(config.mail), audio, logger: true });
app.log.info({ applied }, "migrations applied");
app.log.info({ transport: config.mail.transport, appUrl: config.appUrl }, "magic links");
app.log.info(
  config.audio === null ? "TTS_URL is not set: narration is unavailable" : { tts: config.audio.ttsUrl, audioDir: config.audio.audioDir },
  "narration",
);
app.log.info(
  config.staticRoot === null ? "STATIC_ROOT is not set: serving the API only" : { root: config.staticRoot },
  "web app",
);
await app.listen({ port: config.port, host: "0.0.0.0" });
