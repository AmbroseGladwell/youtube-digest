import pg from "pg";
import { VideoId } from "@overview/domain";
import { createPgSqlClient } from "../db/createPgSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { ConfigError, loadConfig } from "../loadConfig.js";
import { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";

// A wrong or poisoned transcript out of the shared cache, and with --contributors everything
// the accounts that vouched for it added too (docs/features/shared-transcript-cache.md, "Removing one").
const [videoIdArgument, flag] = process.argv.slice(2);
const parsedVideoId = VideoId.safeParse(videoIdArgument);
if (!parsedVideoId.success || (flag !== undefined && flag !== "--contributors")) {
  console.error("usage: npm run forget-shared-transcript -- <video-id> [--contributors]");
  process.exit(1);
}
const videoId = parsedVideoId.data;

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof ConfigError ? `configuration: ${error.message}` : error);
  process.exit(1);
}

const sql = createPgSqlClient(new pg.Pool({ connectionString: config.databaseUrl }));
await runMigrations(sql, { before: migrationSteps() });
const transcripts = new TranscriptsRepository(sql, () => new Date());
const vouchers = await transcripts.vouchersFor(videoId);
const forgotten =
  flag === "--contributors"
    ? (await transcripts.forgetContributionsOf(vouchers)) + (await transcripts.forgetShared(videoId))
    : await transcripts.forgetShared(videoId);
await sql.close();

console.log(`forgot ${forgotten} shared transcript copies; ${videoId} was vouched for by ${vouchers.join(", ") || "no account on record"}`);
