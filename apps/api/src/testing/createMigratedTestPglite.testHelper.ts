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

// Why one migrated copy and --test-force-exit: docs/conventions/backend-testing-guide.md, "The helpers".
export const createMigratedTestPglite = async (): Promise<PGlite> => {
  migratedDataDir ??= migrateOnce();
  const db = new PGlite({ extensions: { vector }, loadDataDir: await migratedDataDir });
  await db.waitReady;
  return db;
};
