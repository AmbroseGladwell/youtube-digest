import pg from "pg";
import { buildApp } from "./buildApp.js";
import { createPgSqlClient } from "./db/createPgSqlClient.js";
import { runMigrations } from "./db/runMigrations.js";
import { ConfigError, loadConfig } from "./loadConfig.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof ConfigError ? `configuration: ${error.message}` : error);
  process.exit(1);
}

const sql = createPgSqlClient(new pg.Pool({ connectionString: config.databaseUrl }));
const applied = await runMigrations(sql);
const app = await buildApp({ config, sql, logger: true });
app.log.info({ applied }, "migrations applied");
await app.listen({ port: config.port, host: "0.0.0.0" });
