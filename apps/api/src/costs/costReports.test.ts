import test from "node:test";
import assert from "node:assert/strict";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import { runMigrations } from "../db/runMigrations.js";
import { createTestPglite } from "../testing/createTestPglite.testHelper.js";

const READER = "a0000000-0000-4000-8000-000000000001";
const IDLE = "a0000000-0000-4000-8000-000000000002";

const seeded = async () => {
  const sql = createPgliteSqlClient(createTestPglite());
  await runMigrations(sql);
  await sql.query(
    `insert into accounts (id, email, created_at, plan) values
       ($1, 'reader@example.com', '2026-10-20T00:00:00Z', 'plus'),
       ($2, 'idle@example.com', '2026-11-02T00:00:00Z', 'free')`,
    [READER, IDLE],
  );
  await sql.query(
    `insert into account_costs (day, account_id, area, detail, calls, quantity, dollars) values
       ('2026-11-01', $1, 'generation', 'overview', 2, 3000, 0.03),
       ('2026-11-03', $1, 'generation', 'overview', 1, 1000, 0.01),
       ('2026-11-03', $1, 'generation', 'overview-failed', 1, 500, 0.005),
       ('2026-11-03', $1, 'transcripts', 'proxy', 1, 40000, 0),
       ('2026-11-04', $2, 'embeddings', 'search', 1, 12, 0.00000024)`,
    [READER, IDLE],
  );
  await sql.query(
    `insert into overview_usage (month, account_id, key_source, overviews) values
       ('2026-11-01', $1, 'ours', 2), ('2026-11-01', $1, 'own', 1)`,
    [READER],
  );
  await sql.query(`insert into narration_render_usage (day, account_id, renders) values ('2026-11-05', $1, 3)`, [READER]);
  await sql.query(
    `insert into signed_out_costs (day, area, detail, calls, quantity, dollars) values ('2026-11-02', 'generation', 'overview', 1, 900, 0.009)`,
  );
  return sql;
};

const opaque = async (sql: Awaited<ReturnType<typeof seeded>>, accountId: string) =>
  (await sql.query<{ account: string }>("select md5('cost-report:' || $1) as account", [accountId]))[0]!.account;

test("each account's month adds up its costs, overviews on each key and renders, and is active once it made an overview", async () => {
  const sql = await seeded();

  const rows = await sql.query<Record<string, unknown>>(
    `select account, plan, joined_month::text, overviews_ours::int, overviews_own::int, renders::int,
            round(metered_dollars::numeric, 8)::float8 as metered_dollars, proxy_bytes, active
     from cost_reports.account_months where month = '2026-11-01' order by plan desc`,
  );

  assert.deepEqual(rows, [
    {
      account: await opaque(sql, READER),
      plan: "plus",
      joined_month: "2026-10-01",
      overviews_ours: 2,
      overviews_own: 1,
      renders: 3,
      metered_dollars: 0.045,
      proxy_bytes: 40000,
      active: true,
    },
    {
      account: await opaque(sql, IDLE),
      plan: "free",
      joined_month: "2026-11-01",
      overviews_ours: 0,
      overviews_own: 0,
      renders: 0,
      metered_dollars: 0.00000024,
      proxy_bytes: 0,
      active: false,
    },
  ]);
  await sql.close();
});

test("cost lines keep each area and detail by month, and signed-out callers under a plan of their own with no account", async () => {
  const sql = await seeded();

  const rows = await sql.query<Record<string, unknown>>(
    `select account is null as no_account, plan, area, detail, calls::int, quantity
     from cost_reports.cost_lines where month = '2026-11-01' and area = 'generation' order by plan, detail`,
  );

  assert.deepEqual(rows, [
    { no_account: false, plan: "plus", area: "generation", detail: "overview", calls: 3, quantity: 4000 },
    { no_account: false, plan: "plus", area: "generation", detail: "overview-failed", calls: 1, quantity: 500 },
    { no_account: true, plan: "signed-out", area: "generation", detail: "overview", calls: 1, quantity: 900 },
  ]);
  await sql.close();
});

test("no report names an account by its id or its email", async () => {
  const sql = await seeded();

  const reports = await sql.query<{ row: string }>(
    `select row_to_json(l)::text as row from cost_reports.cost_lines l
     union all select row_to_json(m)::text from cost_reports.account_months m`,
  );

  for (const { row } of reports) {
    assert.doesNotMatch(row, new RegExp(`${READER}|${IDLE}|@example\\.com`));
  }
  await sql.close();
});

test("a deleted account leaves the reports with its rows", async () => {
  const sql = await seeded();

  await sql.query("delete from accounts where id = $1", [READER]);

  const [left] = await sql.query<{ months: number; lines: number }>(
    `select (select count(*)::int from cost_reports.account_months where account = $1) as months,
            (select count(*)::int from cost_reports.cost_lines where account = $1) as lines`,
    [await opaque(sql, READER)],
  );
  assert.deepEqual(left, { months: 0, lines: 0 });
  await sql.close();
});

test("the reader role can read the reports and no table behind them", async () => {
  const sql = await seeded();

  const privileges = await sql.query<{ relation: string; readable: boolean }>(
    `select c.oid::regclass::text as relation, has_table_privilege('cost_reader', c.oid, 'select') as readable
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'cost_reports') and c.relkind in ('r', 'v', 'm', 'p')
     order by 1`,
  );
  const readable = privileges.filter((relation) => relation.readable).map((relation) => relation.relation);
  assert.deepEqual(readable, ["cost_reports.account_months", "cost_reports.cost_lines", "cost_reports.plan_accounts"]);

  const [role] = await sql.query<{ login: boolean; memberships: number }>(
    `select rolcanlogin as login, (select count(*)::int from pg_auth_members where member = r.oid) as memberships
     from pg_roles r where rolname = 'cost_reader'`,
  );
  assert.deepEqual(role, { login: false, memberships: 0 });
  await sql.close();
});
