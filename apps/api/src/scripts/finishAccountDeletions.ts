import pg from "pg";
import { finishAccountDeletion } from "../auth/deleteAccount.js";
import { AccountDeletionsRepository } from "../auth/AccountDeletionsRepository.js";
import { createAudioSetup } from "../audio/createAudioSetup.js";
import { createPgSqlClient } from "../db/createPgSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { ConfigError, loadConfig } from "../loadConfig.js";
import { createPostHogPersonEraser } from "../postHog/postHogPersonEraser.js";

// docs/features/account-deletion.md, "The order, and what the reader is promised".
let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof ConfigError ? `configuration: ${error.message}` : error);
  process.exit(1);
}

// Why it names the database and the erasure first: same section; never a credential.
const { hostname, pathname } = new URL(config.databaseUrl);
console.error(`Looking in ${pathname.replace(/^\//, "")} on ${hostname}.`);
console.error(
  config.analytics.erasure === null
    ? "PostHog erasure is NOT configured here, so those steps will stay unfinished. Import POSTHOG_PERSONAL_API_KEY first."
    : `PostHog erasure is configured, against project ${config.analytics.erasure.projectId}.`,
);

const sql = createPgSqlClient(new pg.Pool({ connectionString: config.databaseUrl }));
await runMigrations(sql, { before: migrationSteps() });
const narrationStore = config.audio === null ? null : createAudioSetup(config.audio, false).store;
const personEraser = config.analytics.erasure === null ? null : createPostHogPersonEraser(config.analytics.erasure);
const log = { error: (line: object) => console.error(JSON.stringify(line)) };

const unfinished = await new AccountDeletionsRepository(sql).listUnfinished();
for (const deletion of unfinished) {
  const finished = await finishAccountDeletion(sql, deletion, { narrationStore, personEraser, log, now: () => new Date() });
  console.error(
    `${finished.id} (deleted ${finished.deletedAt.toISOString()}): narration ${finished.narration}, PostHog account ${finished.postHogAccount}, PostHog anonymous ${finished.postHogAnonymous}${finished.finishedAt === null ? ", still unfinished" : ", finished"}`,
  );
}
await sql.close();
console.error(unfinished.length === 0 ? "no unfinished deletions" : `${unfinished.length} retried`);
