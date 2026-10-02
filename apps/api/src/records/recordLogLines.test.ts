import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSIONS } from "@overview/domain";
import { LOG_LEVELS, recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { rawOverviewAtVersion2, storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";

const CURRENT = CURRENT_SCHEMA_VERSIONS.overview;
const READER_TEXT = "A sentence only the reader wrote";

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("a write that migrates a stored record logs the version it came from and the one it was written at", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const id = randomUUID();
  await account.seedRaw("overview", id, 2, rawOverviewAtVersion2(id));

  await account.inject({ method: "PUT", url: `/api/overviews/${id}/topics`, body: { topicIds: [], updatedAt: UPDATED_AT } });

  const [written] = saying(lines, "record written");
  assert.deepEqual(
    { schemaVersion: written!.schemaVersion, migratedFrom: written!.migratedFrom },
    { schemaVersion: CURRENT, migratedFrom: 2 },
  );
  await testApp.close();
});

test("a write at the version already stored names no migration", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  await account.inject({ method: "PUT", url: `/api/overviews/${overview.id}/topics`, body: { topicIds: [], updatedAt: UPDATED_AT } });

  assert.deepEqual(saying(lines, "record written").map(({ migratedFrom }) => migratedFrom), [undefined, undefined]);
  await testApp.close();
});

test("a record newer than the client is refused at warn with its kind and both versions", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const id = randomUUID();
  await account.seedRaw("overview", id, CURRENT + 1, { id, fromTheFuture: true });

  await account.inject({ method: "PUT", url: `/api/overviews/${id}/capture-reason`, body: { captureReason: READER_TEXT, updatedAt: UPDATED_AT } });

  const [refused] = saying(lines, "request refused");
  assert.equal(refused!.level, LOG_LEVELS.warn);
  assert.deepEqual(
    { code: refused!.code, kind: refused!.kind, storedSchemaVersion: refused!.storedSchemaVersion, clientSchemaVersion: refused!.clientSchemaVersion },
    { code: "record_newer_than_client", kind: "overview", storedSchemaVersion: CURRENT + 1, clientSchemaVersion: CURRENT },
  );
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(READER_TEXT));
  await testApp.close();
});

test("an invalid record is refused with its kind and version, never the validation detail that can quote it", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const overview = { ...storedOverview(), keyPoints: READER_TEXT };

  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  assert.equal(response.statusCode, 400);
  const [refused] = saying(lines, "request refused");
  assert.deepEqual(
    { code: refused!.code, kind: refused!.kind, schemaVersion: refused!.schemaVersion, detail: refused!.detail },
    { code: "invalid_request", kind: "overview", schemaVersion: CURRENT, detail: undefined },
  );
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(READER_TEXT));
  await testApp.close();
});
