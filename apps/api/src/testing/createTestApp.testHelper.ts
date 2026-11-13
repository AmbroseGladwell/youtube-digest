import { createTestPglite } from "./createTestPglite.testHelper.js";
import type { Embedder } from "../meaning/Embedder.js";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
  makeMemoryAudioStore,
  makeScriptedNarrator,
  type MemoryAudioStore,
  type ScriptedNarrator,
} from "../audio/ScriptedNarrator.testHelper.js";
import { AudioRendersRepository } from "../audio/AudioRendersRepository.js";
import { seedVoiceSamples, type SeededVoiceSamples } from "../audio/seedVoiceSamples.js";
import { VoiceSamplesRepository } from "../audio/VoiceSamplesRepository.js";
import { buildApp, type AppConfig, type BuildAppOptions, type OurKeySetup, type TranscriptServiceSetup } from "../buildApp.js";
import type { PlaylistReader } from "../playlists/PlaylistReader.js";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import type { SqlClient } from "../db/SqlClient.js";
import { makeRecordingErrorSink, type RecordingErrorSink } from "../errors/RecordingErrorSink.testHelper.js";
import { makeRecordingEventSink, type RecordingEventSink } from "../events/RecordingEventSink.testHelper.js";
import { makeRecordingMailer, type RecordingMailer } from "../mail/RecordingMailer.testHelper.js";
import { makeRecordingPersonEraser, type RecordingPersonEraser } from "../postHog/RecordingPersonEraser.testHelper.js";

export interface TestClock {
  now: Date;
  advance(ms: number): void;
}

export interface TestApp {
  app: FastifyInstance;
  sql: SqlClient;
  clock: TestClock;
  // Every magic link the app sent, as the reader would receive it.
  mailer: RecordingMailer;
  // Every batch of checked events the app passed on, as PostHog would receive them.
  eventSink: RecordingEventSink;
  // Every batch of checked client errors, as PostHog's error tracking would receive them.
  errorSink: RecordingErrorSink;
  // Every distinct id a deleted account asked PostHog to erase.
  personEraser: RecordingPersonEraser;
  // The TTS service and the audio store narration goes through, and the queue a test drains
  // itself rather than race a background worker.
  narrator: ScriptedNarrator;
  audioStore: MemoryAudioStore;
  drainAudio(): Promise<void>;
  drainEmbeddings(): Promise<void>;
  // The deploy's release step, at the test's clock.
  seedVoiceSamples(): Promise<SeededVoiceSamples>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  fetchArticlePage?: BuildAppOptions["fetchArticlePage"];
  readPodcastEpisode?: BuildAppOptions["readPodcastEpisode"];
  podcastWeb?: BuildAppOptions["podcastWeb"];
  narration?: boolean;
  logger?: FastifyBaseLogger;
  slowQueryMs?: number;
  transcriptService?: TranscriptServiceSetup;
  ourKey?: OurKeySetup;
  // Search by meaning on this embedder, with its queue drained by the test.
  embedder?: Embedder;
  playlistReader?: PlaylistReader;
  // The database left at an earlier migration, so a test can seed what a later one cleans up
  // and then run it with runMigrations.
  migrationsUpTo?: number;
}

export const TEST_APP_URL = "https://overview.test";
export const TEST_SUPPORT_EMAIL = "help@overview.test";

// The whole API against a real Postgres in process, with a clock the test owns
// (docs/conventions/backend-testing-guide.md).
export async function createTestApp(
  config: Partial<AppConfig> = {},
  {
    narration = true,
    logger,
    slowQueryMs,
    transcriptService,
    ourKey,
    embedder,
    playlistReader,
    migrationsUpTo,
    fetchArticlePage,
    readPodcastEpisode,
    podcastWeb,
  }: TestAppOptions = {},
): Promise<TestApp> {
  const sql = createPgliteSqlClient(createTestPglite());
  await runMigrations(sql, { before: migrationSteps(), ...(migrationsUpTo === undefined ? {} : { upTo: migrationsUpTo }) });
  const clock: TestClock = {
    now: new Date("2026-09-26T09:00:00.000Z"),
    advance(ms) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  const mailer = makeRecordingMailer();
  const narrator = makeScriptedNarrator();
  const audioStore = makeMemoryAudioStore();
  const eventSink = makeRecordingEventSink();
  const errorSink = makeRecordingErrorSink();
  const personEraser = makeRecordingPersonEraser();
  const app = await buildApp({
    config: {
      minSupportedClientVersion: 1,
      sessionTtlDays: 30,
      allowedOrigins: [],
      appUrl: TEST_APP_URL,
      staticRoot: null,
      clientIpHeader: null,
      sampleShareTokens: [],
      supportEmail: TEST_SUPPORT_EMAIL,
      ...config,
    },
    sql,
    mailer,
    audio: narration ? { narrator, store: audioStore, concurrency: 1, runWorkers: false } : null,
    transcriptService: transcriptService ?? null,
    ourKey: ourKey ?? null,
    meaning: embedder === undefined ? null : { embedder, runWorkers: false },
    ...(fetchArticlePage === undefined ? {} : { fetchArticlePage }),
    ...(readPodcastEpisode === undefined ? {} : { readPodcastEpisode }),
    ...(podcastWeb === undefined ? {} : { podcastWeb }),
    playlistReader: playlistReader ?? null,
    eventSink,
    errorSink,
    personEraser,
    clock: () => clock.now,
    ...(logger === undefined ? {} : { logger }),
    ...(slowQueryMs === undefined ? {} : { slowQueryMs }),
  });
  await app.ready();
  return {
    app,
    sql,
    clock,
    mailer,
    eventSink,
    errorSink,
    personEraser,
    narrator,
    audioStore,
    drainAudio: async () => {
      await app.audioQueue?.drain();
    },
    drainEmbeddings: async () => {
      await app.embeddingQueue?.drain();
    },
    seedVoiceSamples: () =>
      seedVoiceSamples({
        renders: new AudioRendersRepository(sql),
        samples: new VoiceSamplesRepository(sql),
        store: audioStore,
        now: clock.now,
      }),
    close: async () => {
      await app.close();
      await sql.close();
    },
  };
}
