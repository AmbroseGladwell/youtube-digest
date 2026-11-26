import { createMigratedTestPglite } from "./createMigratedTestPglite.testHelper.js";
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
import type { VideoReader } from "../videos/youTubeDataApiVideoReader.js";
import type { Transcriber } from "../podcasts/Transcriber.js";
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
  mailer: RecordingMailer;
  eventSink: RecordingEventSink;
  errorSink: RecordingErrorSink;
  personEraser: RecordingPersonEraser;
  narrator: ScriptedNarrator;
  audioStore: MemoryAudioStore;
  drainAudio(): Promise<void>;
  drainEmbeddings(): Promise<void>;
  drainTranscriptions(): Promise<void>;
  drainQuestions(): Promise<void>;
  seedVoiceSamples(): Promise<SeededVoiceSamples>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  fetchArticlePage?: BuildAppOptions["fetchArticlePage"];
  readPodcastEpisode?: BuildAppOptions["readPodcastEpisode"];
  podcastWeb?: BuildAppOptions["podcastWeb"];
  tiktokReader?: BuildAppOptions["tiktokReader"];
  socialReader?: BuildAppOptions["socialReader"];
  narration?: boolean;
  dollarsPerMachineHour?: number | null;
  logger?: FastifyBaseLogger;
  slowQueryMs?: number;
  transcriptService?: TranscriptServiceSetup;
  ourKey?: OurKeySetup;
  embedder?: Embedder;
  playlistReader?: PlaylistReader;
  videoReader?: VideoReader;
  transcriber?: Transcriber;
  migrationsUpTo?: number;
}

export const TEST_APP_URL = "https://overview.test";
export const TEST_SUPPORT_EMAIL = "help@overview.test";

export const createTestApp = async (
  config: Partial<AppConfig> = {},
  {
    narration = true,
    dollarsPerMachineHour = null,
    logger,
    slowQueryMs,
    transcriptService,
    ourKey,
    embedder,
    playlistReader,
    videoReader,
    transcriber,
    migrationsUpTo,
    fetchArticlePage,
    readPodcastEpisode,
    podcastWeb,
    tiktokReader,
    socialReader,
  }: TestAppOptions = {},
): Promise<TestApp> => {
  const sql = createPgliteSqlClient(migrationsUpTo === undefined ? await createMigratedTestPglite() : createTestPglite());
  if (migrationsUpTo !== undefined) {
    await runMigrations(sql, { before: migrationSteps(), upTo: migrationsUpTo });
  }
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
    audio: narration ? { narrator, store: audioStore, concurrency: 2, liveSlots: 1, dollarsPerMachineHour, runWorkers: false } : null,
    transcriptService: transcriptService ?? null,
    ourKey: ourKey ?? null,
    speechToText:
      transcriber === undefined ? null : { transcriber, concurrency: 1, runWorkers: false, sleep: async (ms) => clock.advance(ms) },
    meaning: embedder === undefined ? null : { embedder, runWorkers: false },
    ...(fetchArticlePage === undefined ? {} : { fetchArticlePage }),
    ...(readPodcastEpisode === undefined ? {} : { readPodcastEpisode }),
    ...(podcastWeb === undefined ? {} : { podcastWeb }),
    ...(tiktokReader === undefined ? {} : { tiktokReader }),
    ...(socialReader === undefined ? {} : { socialReader }),
    playlistReader: playlistReader ?? null,
    videoReader: videoReader ?? null,
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
    drainTranscriptions: async () => {
      await app.transcriptionQueue?.drain();
    },
    drainQuestions: async () => {
      await app.questionRefresher?.drain();
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
};
