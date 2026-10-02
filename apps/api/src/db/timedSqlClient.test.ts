import test from "node:test";
import assert from "node:assert/strict";
import { REQUEST_ID_HEADER } from "@overview/domain";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { LOG_LEVELS, recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import type { SqlClient } from "./SqlClient.js";
import { timedSqlClient } from "./timedSqlClient.js";

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

const takingMs = (durationMs: number) => {
  let now = 0;
  const inner: SqlClient = {
    query: async () => {
      now += durationMs;
      return [];
    },
    execute: async () => {
      now += durationMs;
    },
    transaction: (run) => run(inner),
    close: async () => {},
  };
  return { inner, now: () => now };
};

test("a query at or past the threshold is logged at warn with its statement and never its parameters", async () => {
  const { lines, logger } = recordingLogger();
  const { inner, now } = takingMs(800);
  const sql = timedSqlClient(inner, { log: () => logger, slowMs: 500, now });

  await sql.query("select body\n   from records where account_id = $1", ["reader@example.com"]);

  const [slow] = saying(lines, "slow query");
  assert.deepEqual(
    { level: slow!.level, durationMs: slow!.durationMs, statement: slow!.statement },
    { level: LOG_LEVELS.warn, durationMs: 800, statement: "select body from records where account_id = $1" },
  );
  assert.doesNotMatch(JSON.stringify(lines), /reader@example\.com/);
});

test("a quick query logs nothing, and a slow transaction is logged as one with the slow query inside it", async () => {
  const { lines, logger } = recordingLogger();
  const quick = takingMs(10);
  await timedSqlClient(quick.inner, { log: () => logger, slowMs: 500, now: quick.now }).query("select 1");
  assert.equal(lines.length, 0);

  const slow = takingMs(600);
  await timedSqlClient(slow.inner, { log: () => logger, slowMs: 500, now: slow.now }).transaction((tx) => tx.query("select 2"));

  assert.deepEqual(lines.map(({ msg, durationMs }) => [msg, durationMs]), [
    ["slow query", 600],
    ["slow transaction", 600],
  ]);
});

test("a slow query made for a request is logged under that request's id and account", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger, slowQueryMs: 0 });
  const session = await makeSession(testApp.sql, { now: testApp.clock.now });

  await testApp.app.inject({ method: "GET", url: "/api/changes", headers: { ...session.headers, [REQUEST_ID_HEADER]: "request-0001" } });

  const forRequest = saying(lines, "slow query").filter(({ reqId }) => reqId === "request-0001");
  assert.ok(forRequest.length > 0);
  assert.ok(forRequest.some(({ accountId }) => accountId === session.accountId));
  await testApp.close();
});
