import test from "node:test";
import assert from "node:assert/strict";
import { createTestPglite } from "../testing/createTestPglite.testHelper.js";
import { shareContentHash, sourceKey, storedSourceKey, type SharedNote } from "@overview/domain";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { migrationsBefore } from "../db/migrationsBefore.testHelper.js";
import { runMigrations } from "../db/runMigrations.js";
import type { SqlClient } from "../db/SqlClient.js";

const ACCOUNT = "a0000000-0000-4000-8000-000000000001";
const UPDATED_AT = "2026-11-02T00:00:00.000Z";

async function migratedDatabase(): Promise<SqlClient> {
  const sql = createPgliteSqlClient(createTestPglite());
  await runMigrations(sql, { before: migrationSteps() });
  await sql.query("insert into accounts (id, email, created_at) values ($1, $2, now())", [ACCOUNT, "reader@example.com"]);
  return sql;
}

let seq = 0;
const insertOverview = async (sql: SqlClient, body: unknown, id = crypto.randomUUID()) => {
  seq += 1;
  await sql.query(
    `insert into records (account_id, kind, id, schema_version, rev, seq, updated_at, deleted, body)
     values ($1, 'overview', $2, 10, 1, $3, $4, false, $5::jsonb)`,
    [ACCOUNT, id, seq, UPDATED_AT, JSON.stringify(body)],
  );
  return id;
};

const keyInColumn = async (sql: SqlClient, id: string) =>
  (await sql.query<{ source_key: string | null }>("select source_key from records where id = $1", [id]))[0]!.source_key;

test("the column gives the key the domain gives, for every shape a stored body can have", async () => {
  const sql = await migratedDatabase();
  const bodies = [
    { video: { id: "abc123XYZ_-" } },
    { source: { kind: "youtube", id: "def456" } },
    { source: { kind: "web", id: "9f2c" } },
    { source: { kind: "podcast", id: "9f2c" } },
    { video: { id: null } },
    { source: { kind: "youtube", id: null } },
  ];
  for (const body of bodies) {
    assert.equal(await keyInColumn(sql, await insertOverview(sql, body)), storedSourceKey(body), JSON.stringify(body));
  }
});

test("a video stored at either shape is one item, so the old shape cannot duplicate the new", async () => {
  const sql = await migratedDatabase();
  await insertOverview(sql, { video: { id: "same" } });
  await assert.rejects(insertOverview(sql, { source: { kind: "youtube", id: "same" } }), /records_one_live_overview_per_source/);
});

test("one id under two kinds is two items", async () => {
  const sql = await migratedDatabase();
  await insertOverview(sql, { source: { kind: "youtube", id: "same" } });
  const web = await insertOverview(sql, { source: { kind: "web", id: "same" } });
  assert.equal(await keyInColumn(sql, web), sourceKey({ kind: "web", id: "same" }));
});

async function databaseWithShares(notes: Array<{ token: string; note: Record<string, unknown>; hash: string }>): Promise<SqlClient> {
  const sql = createPgliteSqlClient(createTestPglite());
  await runMigrations(sql, { dir: await migrationsBefore(24), before: migrationSteps() });
  await sql.query("insert into accounts (id, email, created_at) values ($1, $2, now())", [ACCOUNT, "reader@example.com"]);
  for (const { token, note, hash } of notes) {
    await sql.query(
      `insert into shares (token, account_id, overview_id, snapshot, content_hash, shared_at, updated_at)
       values ($1, $2, $3, $4::jsonb, $5, now(), now())`,
      [token, ACCOUNT, crypto.randomUUID(), JSON.stringify({ note, transcript: null, narration: null }), hash],
    );
  }
  await runMigrations(sql, { before: migrationSteps() });
  return sql;
}

const oldNote = { id: "a", video: { id: "abc", title: "Kept" }, coreClaim: "A claim" };
const movedNote = { id: "a", source: { id: "abc", title: "Kept", kind: "youtube" }, coreClaim: "A claim" };
const oldHash = await shareContentHash(oldNote as unknown as SharedNote);
const movedHash = await shareContentHash(movedNote as unknown as SharedNote);
const shareRow = async (sql: SqlClient, token: string) =>
  (await sql.query<{ snapshot: { note: unknown }; content_hash: string }>("select snapshot, content_hash from shares where token = $1", [token]))[0]!;

test("a share moves to source and its hash follows, so an unedited link does not read as edited", async () => {
  const sql = await databaseWithShares([{ token: "aaaaaaaaaaaaaaaa", note: oldNote, hash: oldHash }]);
  const { snapshot, content_hash } = await shareRow(sql, "aaaaaaaaaaaaaaaa");
  assert.deepEqual(snapshot.note, movedNote);
  assert.equal(content_hash, movedHash);
});

test("a share whose overview was edited afterwards still reads as edited", async () => {
  const sql = await databaseWithShares([{ token: "bbbbbbbbbbbbbbbb", note: oldNote, hash: oldHash }]);
  const editedSince = { ...movedNote, coreClaim: "An edited claim" };
  const { content_hash } = await shareRow(sql, "bbbbbbbbbbbbbbbb");
  assert.notEqual(content_hash, await shareContentHash(editedSince as unknown as SharedNote));
});
