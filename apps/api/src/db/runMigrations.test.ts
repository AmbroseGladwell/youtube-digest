import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createPgliteSqlClient } from "./createPgliteSqlClient.js";
import { runMigrations } from "./runMigrations.js";

test("applies every migration file in version order and records each one", async () => {
  const sql = createPgliteSqlClient(new PGlite());
  const applied = await runMigrations(sql);

  assert.deepEqual(
    applied.map((migration) => migration.version),
    applied.map((_, index) => index + 1),
  );
  const recorded = await sql.query<{ version: number; name: string }>(
    "select version, name from schema_migrations order by version",
  );
  assert.deepEqual(recorded, applied);
  await sql.close();
});

test("a second run applies nothing, so starting the server twice is safe", async () => {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql);

  assert.deepEqual(await runMigrations(sql), []);
  await sql.close();
});

test("the tables the migrations create are there to be used", async () => {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql);

  const tables = await sql.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  assert.deepEqual(
    tables.map((table) => table.table_name),
    ["accounts", "records", "schema_migrations", "sessions"],
  );
  await sql.close();
});
