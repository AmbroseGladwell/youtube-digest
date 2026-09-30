import pg from "pg";
import { Plan } from "@overview/domain";
import { setAccountPlan } from "../auth/setAccountPlan.js";
import { createPgSqlClient } from "../db/createPgSqlClient.js";
import { runMigrations } from "../db/runMigrations.js";
import { ConfigError, loadConfig } from "../loadConfig.js";

const [email, plan] = process.argv.slice(2);
const parsedPlan = Plan.safeParse(plan);
if (!email || !parsedPlan.success) {
  console.error("usage: npm run set-plan -- <email> <free|plus>");
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
const updated = await setAccountPlan(sql, email, parsedPlan.data);
await sql.close();

if (!updated) {
  console.error(`no account for ${email}: it is made by signing in first`);
  process.exit(1);
}
console.error(`${email} is now on ${parsedPlan.data}`);
