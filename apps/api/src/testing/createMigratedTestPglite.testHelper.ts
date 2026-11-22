import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { createTestPglite } from "./createTestPglite.testHelper.js";

let migratedDataDir: Promise<Blob> | undefined;

const migrateOnce = async (): Promise<Blob> => {
  const template = createTestPglite();
  await runMigrations(createPgliteSqlClient(template), { before: migrationSteps() });
  const dataDir = await template.dumpDataDir("none");
  await template.close();
  return dataDir;
};

// Migrated once per test process and loaded from that copy after, since booting and migrating a
// fresh database took most of every route test's time. A loaded database holds a timer until it is
// closed, which is why npm test passes --test-force-exit (docs/conventions/backend-testing-guide.md).
export const createMigratedTestPglite = async (): Promise<PGlite> => {
  migratedDataDir ??= migrateOnce();
  const db = new PGlite({ extensions: { vector }, loadDataDir: await migratedDataDir });
  await db.waitReady;
  return db;
};
