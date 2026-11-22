import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { createTestPglite } from "./createTestPglite.testHelper.js";

let migratedDataDir: Promise<Blob> | undefined;

async function migrateOnce(): Promise<Blob> {
  const template = createTestPglite();
  await runMigrations(createPgliteSqlClient(template), { before: migrationSteps() });
  const dataDir = await template.dumpDataDir("none");
  await template.close();
  return dataDir;
}

// Migrated once per test process and loaded from that copy after, since booting and migrating a
// fresh database took most of every route test's time (docs/conventions/backend-testing-guide.md).
export async function createMigratedTestPglite(): Promise<PGlite> {
  migratedDataDir ??= migrateOnce();
  const db = new PGlite({ extensions: { vector }, loadDataDir: await migratedDataDir });
  await db.waitReady;
  return db;
}
