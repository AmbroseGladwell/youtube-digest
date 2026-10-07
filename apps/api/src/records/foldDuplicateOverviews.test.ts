import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { CURRENT_SCHEMA_VERSIONS, OverviewId, TopicId, VideoId } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { migrationsBefore } from "../db/migrationsBefore.testHelper.js";
import { runMigrations } from "../db/runMigrations.js";
import type { SqlClient } from "../db/SqlClient.js";
import { RECORD_COLUMNS } from "./RecordsRepository.js";
import { storedRecordFromRow, type RecordRow } from "./StoredRecord.js";

const ACCOUNT = "a0000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT = "a0000000-0000-4000-8000-000000000002";
const TOPIC_A = TopicId.parse(randomUUID());
const TOPIC_B = TopicId.parse(randomUUID());

async function databaseBeforeTheIndex(): Promise<SqlClient> {
  const sql = createPgliteSqlClient(new PGlite());
  await runMigrations(sql, { dir: await migrationsBefore(18) });
  for (const id of [ACCOUNT, OTHER_ACCOUNT]) {
    await sql.query("insert into accounts (id, email, created_at) values ($1, $2, now())", [id, `${id}@example.com`]);
  }
  return sql;
}

async function seed(
  sql: SqlClient,
  accountId: string,
  kind: "overview" | "overviewState",
  id: string,
  body: Record<string, unknown>,
  updatedAt: string,
  schemaVersion = CURRENT_SCHEMA_VERSIONS[kind],
): Promise<void> {
  const [row] = await sql.query<{ last_seq: number | string | bigint }>(
    "update accounts set last_seq = last_seq + 1 where id = $1 returning last_seq",
    [accountId],
  );
  await sql.query(
    `insert into records (account_id, kind, id, schema_version, rev, seq, updated_at, deleted, body)
     values ($1, $2, $3, $4, 1, $5, $6, false, $7::jsonb)`,
    [accountId, kind, id, schemaVersion, Number(row!.last_seq), updatedAt, JSON.stringify(body)],
  );
}

const live = async (sql: SqlClient, accountId = ACCOUNT) =>
  (
    await sql.query<RecordRow>(
      `select ${RECORD_COLUMNS} from records where account_id = $1 order by seq`,
      [accountId],
    )
  ).map(storedRecordFromRow);

test("per account and video the earliest-made overview is kept, the others' filing and state fold onto it, and the others are tombstoned", async () => {
  const sql = await databaseBeforeTheIndex();
  const video = { ...makeOverview().video, id: VideoId.parse("twice") };
  const earlier = makeOverview({ video, savedAt: "2026-09-01T00:00:00.000Z", topicIds: [TOPIC_A], tags: ["one"], captureReason: null });
  const later = makeOverview({ video, savedAt: "2026-09-02T00:00:00.000Z", topicIds: [TOPIC_B], tags: ["one", "two"], captureReason: "Why" });
  // Seeded in the opposite order, so arrival order and creation order disagree.
  await seed(sql, ACCOUNT, "overview", later.id, later, "2026-09-02T00:00:00.000Z");
  await seed(sql, ACCOUNT, "overview", earlier.id, earlier, "2026-09-01T00:00:00.000Z");
  await seed(sql, ACCOUNT, "overviewState", later.id, { overviewId: later.id, read: true, favourite: false, userTags: ["later"] }, "2026-09-03T00:00:00.000Z");
  await seed(sql, ACCOUNT, "overviewState", earlier.id, { overviewId: earlier.id, read: false, favourite: true, userTags: ["keep"] }, "2026-09-02T12:00:00.000Z");

  const folds: unknown[] = [];
  await runMigrations(sql, { before: migrationSteps((folded) => folds.push(...folded)) });

  assert.deepEqual(folds, [{ accountId: ACCOUNT, videoId: "twice", kept: earlier.id, folded: [later.id] }]);
  const records = await live(sql);
  const kept = records.find((record) => record.kind === "overview" && record.id === earlier.id)!;
  assert.deepEqual(
    { topicIds: kept.body?.topicIds, tags: kept.body?.tags, captureReason: kept.body?.captureReason, rev: kept.rev, updatedAt: kept.updatedAt },
    { topicIds: [TOPIC_A, TOPIC_B], tags: ["one", "two"], captureReason: "Why", rev: 2, updatedAt: "2026-09-02T00:00:00.000Z" },
  );
  const keptState = records.find((record) => record.kind === "overviewState" && record.id === earlier.id)!;
  assert.deepEqual(keptState.body, { overviewId: earlier.id, read: true, favourite: true, userTags: ["keep", "later"] });
  assert.equal(keptState.updatedAt, "2026-09-03T00:00:00.000Z");
  const gone = records.filter((record) => record.id === later.id);
  assert.deepEqual(
    gone.map(({ kind, deleted, rev, body }) => ({ kind, deleted, rev, body })),
    [
      { kind: "overview", deleted: true, rev: 2, body: null },
      { kind: "overviewState", deleted: true, rev: 2, body: null },
    ],
  );
  // Every write moved on in the feed, so a device that pulled before sees all of it.
  assert.ok(Math.min(...[kept, keptState, ...gone].map((record) => record.seq)) > 4);
  await sql.close();
});

test("an account holding one overview per video is left exactly as it was, and the index then refuses a second", async () => {
  const sql = await databaseBeforeTheIndex();
  const one = makeOverview({ video: { ...makeOverview().video, id: VideoId.parse("one") } });
  const two = makeOverview({ video: { ...makeOverview().video, id: VideoId.parse("two") } });
  await seed(sql, ACCOUNT, "overview", one.id, one, "2026-09-01T00:00:00.000Z");
  await seed(sql, ACCOUNT, "overview", two.id, two, "2026-09-01T00:00:00.000Z");
  const before = await live(sql);

  const folds: unknown[] = [];
  await runMigrations(sql, { before: migrationSteps((folded) => folds.push(...folded)) });

  assert.deepEqual(folds, []);
  assert.deepEqual(await live(sql), before);
  await assert.rejects(
    seed(sql, ACCOUNT, "overview", OverviewId.parse(randomUUID()), makeOverview({ video: one.video }), "2026-09-02T00:00:00.000Z"),
    /records_one_live_overview_per_video/,
  );
  await sql.close();
});

test("the same video held by two accounts is two overviews, and a tombstoned copy is not a duplicate", async () => {
  const sql = await databaseBeforeTheIndex();
  const video = { ...makeOverview().video, id: VideoId.parse("shared") };
  const mine = makeOverview({ video });
  const theirs = makeOverview({ video });
  const deleted = makeOverview({ video });
  await seed(sql, ACCOUNT, "overview", mine.id, mine, "2026-09-01T00:00:00.000Z");
  await seed(sql, OTHER_ACCOUNT, "overview", theirs.id, theirs, "2026-09-01T00:00:00.000Z");
  await seed(sql, ACCOUNT, "overview", deleted.id, deleted, "2026-09-01T00:00:00.000Z");
  await sql.query("update records set deleted = true, body = null, updated_at = null where id = $1", [deleted.id]);

  const folds: unknown[] = [];
  await runMigrations(sql, { before: migrationSteps((folded) => folds.push(...folded)) });

  assert.deepEqual(folds, []);
  assert.equal((await live(sql)).filter((record) => !record.deleted).length, 1);
  assert.equal((await live(sql, OTHER_ACCOUNT)).length, 1);
  await sql.close();
});

test("a copy stored at an older version is read through the migration chain before its filing is folded", async () => {
  const sql = await databaseBeforeTheIndex();
  const video = { ...makeOverview().video, id: VideoId.parse("old") };
  const kept = makeOverview({ video, savedAt: "2026-09-01T00:00:00.000Z", captureReason: null });
  const { captureReason: _reason, fromPlaylist: _from, chapters: _chapters, ...olderShape } = makeOverview({ video, savedAt: "2026-09-02T00:00:00.000Z" });
  const older = { ...olderShape, savedNote: "From before the rename", keyPoints: ["one", "two", "three"], tags: ["one-tag", "two-tag", "three-tag"] };
  await seed(sql, ACCOUNT, "overview", kept.id, kept, "2026-09-01T00:00:00.000Z");
  await seed(sql, ACCOUNT, "overview", older.id, older, "2026-09-02T00:00:00.000Z", 2);

  await runMigrations(sql, { before: migrationSteps() });

  const record = (await live(sql)).find((candidate) => candidate.kind === "overview" && candidate.id === kept.id)!;
  assert.equal(record.body?.captureReason, "From before the rename");
  assert.equal(record.schemaVersion, CURRENT_SCHEMA_VERSIONS.overview);
  await sql.close();
});
