import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
    [
      "account_transcripts",
      "accounts",
      "audio_renders",
      "link_codes",
      "magic_links",
      "records",
      "schema_migrations",
      "sessions",
      "shared_transcripts",
      "voice_samples",
    ],
  );
  await sql.close();
});

const migrationsBefore = async (version: number): Promise<URL> => {
  const source = fileURLToPath(new URL("../../migrations/", import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), "migrations-"));
  for (const file of await readdir(source)) {
    if (Number(file.slice(1, 5)) < version) await copyFile(join(source, file), join(dir, file));
  }
  return pathToFileURL(`${dir}/`);
};

test("each account's transcripts become one shared copy per video, the best of them, linked back to every account", async () => {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql, await migrationsBefore(8));
  const [first, second] = ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002"];
  for (const id of [first, second]) {
    await sql.query("insert into accounts (id, email, created_at) values ($1, $2, now())", [id, `${id}@example.com`]);
  }
  const transcript = (videoId: string, generated: boolean, segments = [{ text: "Said.", startMs: 0, endMs: 1 }]) =>
    JSON.stringify({ videoId, segments, generated, fetchedAt: "2026-09-01T00:00:00.000Z" });
  const store = (accountId: string, videoId: string, body: string, storedAt: string) =>
    sql.query("insert into transcripts (account_id, video_id, stored_at, body) values ($1, $2, $3, $4::jsonb)", [
      accountId,
      videoId,
      storedAt,
      body,
    ]);
  await store(first, "shared", transcript("shared", true), "2026-09-01T00:00:00.000Z");
  await store(second, "shared", transcript("shared", false), "2026-09-02T00:00:00.000Z");
  await store(first, "empty", transcript("empty", false, []), "2026-09-01T00:00:00.000Z");

  await runMigrations(sql);

  const shared = await sql.query<{ video_id: string; contributed_by: string; generated: boolean }>(
    "select video_id, contributed_by, (body ->> 'generated')::boolean as generated from shared_transcripts",
  );
  const links = await sql.query<{ account_id: string; video_id: string }>(
    "select account_id, video_id from account_transcripts order by account_id",
  );
  assert.deepEqual(shared, [{ video_id: "shared", contributed_by: second, generated: false }]);
  assert.deepEqual(links, [
    { account_id: first, video_id: "shared" },
    { account_id: second, video_id: "shared" },
  ]);
  await sql.close();
});
