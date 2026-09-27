import { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
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
  close(): Promise<void>;
}

export const TEST_APP_URL = "https://overview.test";

// The whole API against a real Postgres in process, with a clock the test owns
// (docs/conventions/backend-testing-guide.md).
export async function createTestApp(config: Partial<AppConfig> = {}): Promise<TestApp> {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql);
  const clock: TestClock = {
    now: new Date("2026-09-26T09:00:00.000Z"),
    advance(ms) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  const mailer = makeRecordingMailer();
  const app = await buildApp({
    config: { minSupportedClientVersion: 1, sessionTtlDays: 30, allowedOrigins: [], appUrl: TEST_APP_URL, staticRoot: null, ...config },
    sql,
    mailer,
    clock: () => clock.now,
  });
  await app.ready();
  return {
    app,
    sql,
    clock,
    mailer,
    close: async () => {
      await app.close();
      await sql.close();
    },
  };
}
