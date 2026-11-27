import test from "node:test";
import assert from "node:assert/strict";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { runMigrations } from "../db/runMigrations.js";
import { createTestPglite } from "../testing/createTestPglite.testHelper.js";
import { ModalSpendGuard } from "./ModalSpendGuard.js";

const ACCOUNT = "a0000000-0000-4000-8000-000000000001";

const seeded = async () => {
  const sql = createPgliteSqlClient(createTestPglite());
  await runMigrations(sql);
  await sql.query("insert into accounts (id, email, created_at, plan) values ($1, 'reader@example.com', '2026-11-01', 'free')", [ACCOUNT]);
  return sql;
};

const cost = (sql: Awaited<ReturnType<typeof seeded>>, day: string, area: string, detail: string, dollars: number) =>
  sql.query("insert into account_costs (day, account_id, area, detail, calls, quantity, dollars) values ($1, $2, $3, $4, 1, 1, $5)", [
    day,
    ACCOUNT,
    area,
    detail,
    dollars,
  ]);

test("Modal stays open under the month's limit and closes once its speech and speech-to-text reach it", async () => {
  const sql = await seeded();
  const closed: number[] = [];
  const guard = new ModalSpendGuard({
    sql,
    monthlyDollars: 10,
    clock: () => new Date("2026-11-20T00:00:00Z"),
    onClosed: (spent) => closed.push(spent),
  });
  await cost(sql, "2026-11-02", "speech", "chat-modal", 4);
  await cost(sql, "2026-11-03", "speech", "chat", 50);
  await cost(sql, "2026-10-30", "speech", "narration-modal", 50);

  await guard.check();
  assert.equal(guard.open(), true);

  await cost(sql, "2026-11-04", "transcripts", "speech-to-text", 6);
  await guard.check();
  assert.equal(guard.open(), false);
  assert.deepEqual(closed, [10]);
  await sql.close();
});

test("with no limit set, Modal is always open", async () => {
  const sql = await seeded();
  const guard = new ModalSpendGuard({ sql, monthlyDollars: null, clock: () => new Date(), onClosed: () => {} });

  assert.equal(guard.open(), true);
  await sql.close();
});
