import pg from "pg";
import { createSession } from "../auth/createSession.js";
import { createPgSqlClient } from "../db/createPgSqlClient.js";
import { runMigrations } from "../db/runMigrations.js";
import { ConfigError, loadConfig } from "../loadConfig.js";

// How a session is born until magic-link sign-in exists: the token goes to stdout alone,
// so a shell can capture it (docs/architecture/api.md).
const email = process.argv[2];
if (!email) {
  console.error("usage: npm run mint-session -- <email>");
  process.exit(1);
}

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof ConfigError ? `configuration: ${error.message}` : error);
  process.exit(1);
}

const sql = createPgSqlClient(new pg.Pool({ connectionString: config.databaseUrl }));
await runMigrations(sql);
const session = await createSession(sql, email, { now: new Date(), sessionTtlDays: config.sessionTtlDays });
await sql.close();

console.error(`account ${session.accountId} for ${email}, session expires ${session.expiresAt}`);
console.log(session.token);
