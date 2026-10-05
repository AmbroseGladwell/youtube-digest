import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readdir, writeFile } from "node:fs/promises";
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

// Two branches each taking the next free number is how one of them gets skipped in
// production without a word.
test("two migrations with one version refuse to run, rather than skipping one", async () => {
  const dir = await mkdtemp(join(tmpdir(), "migrations-"));
  await writeFile(join(dir, "V0001__first.sql"), "create table first_one (id int)");
  await writeFile(join(dir, "V0001__second.sql"), "create table second_one (id int)");
  const sql = createPgliteSqlClient(new PGlite());

  await assert.rejects(runMigrations(sql, pathToFileURL(`${dir}/`)), /two migrations share version 1/);
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
      "connection_tokens",
      "connections",
      "link_codes",
      "magic_links",
      "oauth_authorizations",
      "oauth_clients",
      "records",
      "schema_migrations",
      "service_transcript_usage",
      "sessions",
      "shared_transcripts",
      "shares",
      "transcript_contributions",
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

test("each account keeps the transcripts it stored before the shared cache, and none of them is served", async () => {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql, await migrationsBefore(9));
  const [first, second] = ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002"];
  for (const id of [first, second]) {
    await sql.query("insert into accounts (id, email, created_at) values ($1, $2, now())", [id, `${id}@example.com`]);
  }
  const transcript = (generated: boolean) =>
    JSON.stringify({ videoId: "shared", segments: [{ text: "Said.", startMs: 0, endMs: 1 }], generated, fetchedAt: "2026-09-01T00:00:00.000Z" });
  for (const [accountId, generated] of [[first, true], [second, false]] as const) {
    await sql.query("insert into transcripts (account_id, video_id, stored_at, body) values ($1, 'shared', now(), $2::jsonb)", [
      accountId,
      transcript(generated),
    ]);
  }

  await runMigrations(sql);

  const kept = await sql.query<{ account_id: string; generated: boolean }>(
    `select a.account_id, (s.body ->> 'generated')::boolean as generated
     from account_transcripts a join shared_transcripts s using (video_id, words_hash) order by a.account_id`,
  );
  const [counts] = await sql.query<{ confirmed: number; contributions: number }>(
    `select (select count(*)::int from shared_transcripts where confirmed_at is not null) as confirmed,
            (select count(*)::int from transcript_contributions) as contributions`,
  );
  assert.deepEqual(kept, [
    { account_id: first, generated: true },
    { account_id: second, generated: false },
  ]);
  assert.deepEqual(counts, { confirmed: 0, contributions: 0 });
  await sql.close();
});

test("a share made before OV-83 reads as common knowledge with untimed key points, and one without a verdict keeps none", async () => {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql, await migrationsBefore(13));
  const accountId = "a0000000-0000-4000-8000-000000000001";
  await sql.query("insert into accounts (id, email, created_at) values ($1, $2, now())", [accountId, "a@example.com"]);
  const share = (token: string, verdict: unknown, keyPoints = ["One.", "Two.", "Three."]) =>
    sql.query(
      `insert into shares (token, account_id, overview_id, snapshot, content_hash, shared_at, updated_at)
       values ($1, $2, gen_random_uuid(), $3::jsonb, 'hash', now(), now())`,
      [token, accountId, JSON.stringify({ note: { verdict, keyPoints }, transcript: null, narration: null })],
    );
  await share("withVerdict00000", { novelty: "recycled", dubious: true, reasoning: "Secondhand.", similarTo: [] });
  await share("withoutVerdict00", null);

  await runMigrations(sql);

  const rows = await sql.query<{ token: string; verdict: unknown; key_points: unknown }>(
    "select token, snapshot -> 'note' -> 'verdict' as verdict, snapshot -> 'note' -> 'keyPoints' as key_points from shares order by token",
  );
  const untimed = ["One.", "Two.", "Three."].map((text) => ({ text, range: null }));
  assert.deepEqual(rows, [
    {
      token: "withVerdict00000",
      verdict: { novelty: "common_knowledge", standsOut: null, dubious: true, reasoning: "Secondhand.", similarTo: [] },
      key_points: untimed,
    },
    { token: "withoutVerdict00", verdict: null, key_points: untimed },
  ]);
  await sql.close();
});
