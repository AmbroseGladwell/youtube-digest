import { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import {
  makeMemoryAudioStore,
  makeScriptedNarrator,
  type MemoryAudioStore,
  type ScriptedNarrator,
} from "../audio/ScriptedNarrator.testHelper.js";
import { AudioRendersRepository } from "../audio/AudioRendersRepository.js";
import { seedVoiceSamples, type SeededVoiceSamples } from "../audio/seedVoiceSamples.js";
import { VoiceSamplesRepository } from "../audio/VoiceSamplesRepository.js";
import { buildApp, type AppConfig } from "../buildApp.js";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { runMigrations } from "../db/runMigrations.js";
import type { SqlClient } from "../db/SqlClient.js";
import { makeRecordingMailer, type RecordingMailer } from "../mail/RecordingMailer.testHelper.js";

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
  // The TTS service and the audio store narration goes through, and the queue a test drains
  // itself rather than race a background worker.
  narrator: ScriptedNarrator;
  audioStore: MemoryAudioStore;
  drainAudio(): Promise<void>;
  // The deploy's release step, at the test's clock.
  seedVoiceSamples(): Promise<SeededVoiceSamples>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  narration?: boolean;
}

export const TEST_APP_URL = "https://overview.test";

// The whole API against a real Postgres in process, with a clock the test owns
// (docs/conventions/backend-testing-guide.md).
export async function createTestApp(
  config: Partial<AppConfig> = {},
  { narration = true }: TestAppOptions = {},
): Promise<TestApp> {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql);
  const clock: TestClock = {
    now: new Date("2026-09-26T09:00:00.000Z"),
    advance(ms) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  const mailer = makeRecordingMailer();
  const narrator = makeScriptedNarrator();
  const audioStore = makeMemoryAudioStore();
  const app = await buildApp({
    config: { minSupportedClientVersion: 1, sessionTtlDays: 30, allowedOrigins: [], appUrl: TEST_APP_URL, staticRoot: null, clientIpHeader: null, ...config },
    sql,
    mailer,
    audio: narration ? { narrator, store: audioStore, concurrency: 1, runWorkers: false } : null,
    clock: () => clock.now,
  });
  await app.ready();
  return {
    app,
    sql,
    clock,
    mailer,
    narrator,
    audioStore,
    drainAudio: async () => {
      await app.audioQueue?.drain();
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
