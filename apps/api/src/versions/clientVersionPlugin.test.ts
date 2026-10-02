import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_SURFACE_HEADER, CLIENT_VERSION_HEADER, REQUEST_ID_HEADER } from "@overview/domain";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { LOG_LEVELS, recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

test("a malformed X-Client-Version is a 400 whatever the route", async () => {
  const { app, close } = await createTestApp();
  for (const header of ["1.5", "abc", "0", "-1", ""]) {
    const response = await app.inject({
      method: "GET",
      url: "/api/handshake",
      headers: { [CLIENT_VERSION_HEADER]: header },
    });
    assert.equal(response.statusCode, 400, `header ${JSON.stringify(header)}`);
    assert.equal(response.json().error.code, "invalid_request");
  }
  await close();
});

test("a request without the header is served where the route allows it", async () => {
  const { app, close } = await createTestApp();
  const response = await app.inject({ method: "GET", url: "/api/handshake" });

  assert.equal(response.statusCode, 200);
  await close();
});

test("a client below the floor is refused at warn with its version, the floor, and the shell it is", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({ minSupportedClientVersion: 2 }, { logger });
  const session = await makeSession(testApp.sql, { now: testApp.clock.now });

  await testApp.app.inject({
    method: "POST",
    url: "/api/overviews",
    headers: { ...session.headers, [CLIENT_VERSION_HEADER]: "1", [CLIENT_SURFACE_HEADER]: "extension", [REQUEST_ID_HEADER]: "request-0001" },
    payload: storedOverview(),
  });

  const refused = lines.find(({ msg, reqId }) => msg === "request refused" && reqId === "request-0001")!;
  assert.deepEqual(
    {
      level: refused.level,
      code: refused.code,
      clientVersion: refused.clientVersion,
      minSupportedClientVersion: refused.minSupportedClientVersion,
      surface: refused.surface,
    },
    { level: LOG_LEVELS.warn, code: "client_unsupported", clientVersion: 1, minSupportedClientVersion: 2, surface: "extension" },
  );
  await testApp.close();
});

test("a surface that isn't one of the shells is left off the lines rather than logged as sent", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });

  await testApp.app.inject({
    method: "GET",
    url: "/api/handshake",
    headers: { [CLIENT_SURFACE_HEADER]: "reader@example.com", [REQUEST_ID_HEADER]: "request-0002" },
  });

  const forRequest = lines.filter(({ reqId }) => reqId === "request-0002");
  assert.ok(forRequest.length > 0);
  assert.ok(forRequest.every(({ surface }) => surface === undefined));
  assert.doesNotMatch(JSON.stringify(lines), /reader@example\.com/);
  await testApp.close();
});
