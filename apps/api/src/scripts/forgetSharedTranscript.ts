import pg from "pg";
import { VideoId } from "@overview/domain";
import { createPgSqlClient } from "../db/createPgSqlClient.js";
import { runMigrations } from "../db/runMigrations.js";
import { ConfigError, loadConfig } from "../loadConfig.js";
import { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";

// A wrong or poisoned transcript out of the shared cache, and with --contributor everything
// its contributor added too (docs/features/shared-transcript-cache.md, "Removing one").
const [videoIdArgument, flag] = process.argv.slice(2);
const parsedVideoId = VideoId.safeParse(videoIdArgument);
if (!parsedVideoId.success || (flag !== undefined && flag !== "--contributor")) {
  console.error("usage: npm run forget-shared-transcript -- <video-id> [--contributor]");
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
await runMigrations(sql);
const transcripts = new TranscriptsRepository(sql, () => new Date());
const contributor = await transcripts.contributorOf(videoId);
const forgotten =
  flag === "--contributor" && contributor !== null
    ? await transcripts.forgetContributionsOf(contributor)
    : await transcripts.forgetShared(videoId);
await sql.close();

console.log(`forgot ${forgotten} shared transcript(s); ${videoId} was contributed by ${contributor ?? "no account"}`);
