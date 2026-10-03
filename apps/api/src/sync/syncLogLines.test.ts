import test from "node:test";
import assert from "node:assert/strict";
import { LOG_LEVELS, recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

const READER_TEXT = "A sentence only the reader wrote";

const linesSaying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

const overviewWithText = () =>
  storedOverview({ inOneLine: READER_TEXT, coreClaim: READER_TEXT, captureReason: READER_TEXT });

test("a write is logged at info by kind, id, rev and seq, under its request's id, and never with the record's text", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const overview = overviewWithText();

  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  const [written] = linesSaying(lines, "record written");
  assert.equal(written!.level, LOG_LEVELS.info);
  assert.equal(typeof written!.reqId, "string");
  assert.equal(written!.accountId, account.accountId);
  assert.deepEqual(
    { kind: written!.kind, id: written!.id, rev: written!.rev, seq: written!.seq, deleted: written!.deleted },
    { kind: "overview", id: overview.id, rev: 1, seq: 1, deleted: false },
  );
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(READER_TEXT));
  await testApp.close();
});

test("a delete is logged as a deleted write, and its retry as already deleted", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  await account.inject({ method: "DELETE", url: `/api/overviews/${overview.id}` });
  await account.inject({ method: "DELETE", url: `/api/overviews/${overview.id}` });

  assert.deepEqual(
    linesSaying(lines, "record written").map(({ deleted, rev }) => ({ deleted, rev })),
    [
      { deleted: false, rev: 1 },
      { deleted: true, rev: 2 },
    ],
  );
  const [again] = linesSaying(lines, "record already deleted");
  assert.deepEqual({ level: again!.level, kind: again!.kind, id: again!.id }, { level: LOG_LEVELS.info, kind: "overview", id: overview.id });
  await testApp.close();
});

test("a conflict is logged at warn as a refusal with its code, and writes no record line", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const overview = overviewWithText();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  await account.inject({ method: "POST", url: "/api/overviews", body: overview, ifMatch: 7 });

  const refused = linesSaying(lines, "request refused");
  assert.deepEqual(
    refused.map(({ level, code, status }) => ({ level, code, status })),
    [
      { level: LOG_LEVELS.warn, code: "already_exists", status: 409 },
      { level: LOG_LEVELS.warn, code: "revision_mismatch", status: 412 },
    ],
  );
  assert.ok(refused.every(({ reqId }) => typeof reqId === "string"));
  assert.equal(linesSaying(lines, "record written").length, 1);
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(READER_TEXT));
  await testApp.close();
});

test("a write from below the floor is refused at warn with the client's version", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({ minSupportedClientVersion: 2 }, { logger });
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: "/api/overviews", body: storedOverview(), clientVersion: 1 });

  const [refused] = linesSaying(lines, "request refused");
  assert.deepEqual(
    { level: refused!.level, code: refused!.code, clientVersion: refused!.clientVersion },
    { level: LOG_LEVELS.warn, code: "client_unsupported", clientVersion: 1 },
  );
  await testApp.close();
});

test("a page of the feed is logged at info with where it started, where it ends, and how many it carried", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  for (const overview of [overviewWithText(), overviewWithText(), overviewWithText()]) {
    await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  }

  await account.changes(0, 2);

  const [served] = linesSaying(lines, "changes served");
  assert.deepEqual(
    { level: served!.level, since: served!.since, next: served!.next, count: served!.count, more: served!.more },
    { level: LOG_LEVELS.info, since: 0, next: 2, count: 2, more: true },
  );
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(READER_TEXT));
  await testApp.close();
});
