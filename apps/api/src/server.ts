import pg from "pg";
import { apiLogLines } from "@overview/domain";
import { createAudioSetup } from "./audio/createAudioSetup.js";
import { buildApp } from "./buildApp.js";
import { createPgSqlClient } from "./db/createPgSqlClient.js";
import { migrationSteps } from "./db/migrationSteps.js";
import { runMigrations } from "./db/runMigrations.js";
import { ConfigError, loadConfig } from "./loadConfig.js";
import { createPostHogErrorSink } from "./errors/postHogErrorSink.js";
import { reportProcessErrors } from "./errors/reportProcessErrors.js";
import { createPostHogEventSink } from "./events/postHogEventSink.js";
import { createLogger } from "./logs/createLogger.js";
import { OtlpLogExporter } from "./logs/OtlpLogExporter.js";
import { createMailer } from "./mail/createMailer.js";
import { createTranscriptServiceSetup } from "./transcripts/createTranscriptServiceSetup.js";
import { undiciYouTubeFetch } from "./transcripts/undiciYouTubeFetch.js";
import { youTubeDataApiPlaylistReader } from "./playlists/youTubeDataApiPlaylistReader.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof ConfigError ? `configuration: ${error.message}` : error);
  process.exit(1);
}

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
reportProcessErrors({
  errorSink,
  log: logger,
  clock: () => new Date(),
  exit: () => void Promise.resolve(logExporter?.close()).finally(() => process.exit(1)),
});
const pool = new pg.Pool({ connectionString: config.databaseUrl });
// An idle connection the database drops is emitted here, and an unheard "error" would
// crash the process. The pool replaces the connection on the next query.
pool.on("error", (error) => logger.error(apiLogLines.db.connectionLost({ err: error })));
const sql = createPgSqlClient(pool);
const applied = await runMigrations(sql, {
  before: migrationSteps((folds) => {
    for (const fold of folds) logger.info(apiLogLines.startup.duplicateOverviewsFolded(fold));
  }),
});
const transcriptService =
  config.transcriptService === null ? null : createTranscriptServiceSetup(config.transcriptService);
const app = await buildApp({
  config,
  sql,
  mailer: createMailer(config.mail),
  audio,
  transcriptService,
  playlistReader:
    config.youTubeApiKey === null
      ? null
      : youTubeDataApiPlaylistReader({ apiKey: config.youTubeApiKey, youTubeFetch: undiciYouTubeFetch() }),
  eventSink,
  errorSink,
  logger,
});
app.log.info(apiLogLines.startup.migrationsApplied({ applied }));
app.log.info(apiLogLines.startup.magicLinks({ transport: config.mail.transport, appUrl: config.appUrl }));
app.log.info(apiLogLines.startup.narration(
    config.audio === null
      ? { enabled: false, why: "TTS_URL is not set" }
      : {
          enabled: true,
          tts: config.audio.ttsUrl,
          store: config.audio.store.kind === "r2" ? `r2:${config.audio.store.bucket}` : config.audio.store.dir,
        },
  ));
app.log.info(apiLogLines.startup.transcriptService(
    config.transcriptService === null
      ? { enabled: false, why: "TRANSCRIPT_SERVICE is off" }
      : {
          enabled: true,
          proxy: config.transcriptService.proxyUrl === null ? null : new URL(config.transcriptService.proxyUrl).host,
          proxyDailyFetches: config.transcriptService.proxyDailyFetches,
        },
  ));
app.log.info(apiLogLines.startup.playlists(
    config.youTubeApiKey === null ? { enabled: false, why: "YOUTUBE_API_KEY is not set" } : { enabled: true, source: "YouTube Data API" },
  ));
app.log.info(apiLogLines.startup.analytics(
    postHog === null ? { enabled: false, why: "POSTHOG_API_KEY is not set" } : { enabled: true, host: postHog.host, environment },
  ));
app.log.info(apiLogLines.startup.webApp(
    config.staticRoot === null ? { enabled: false, why: "STATIC_ROOT is not set" } : { enabled: true, root: config.staticRoot },
  ));
app.log.info(apiLogLines.startup.logShipping(
    config.logs === null ? { enabled: false, why: "no OTLP logs endpoint" } : { enabled: true, endpoint: new URL(config.logs.endpoint).origin },
  ));

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
