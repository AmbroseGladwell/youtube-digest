import test from "node:test";
import assert from "node:assert/strict";
import { REQUEST_ID_HEADER } from "@overview/domain";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { recordingLogger, type LogLine } from "./recordingLogger.testHelper.js";

const EMAIL = "reader@example.com";

const linesFor = (lines: LogLine[], reqId: string) => lines.filter((line) => line.reqId === reqId);

test("every line of a signed-in request carries its account, its session and the client's version, the completed line included", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const session = await makeSession(testApp.sql, { now: testApp.clock.now });

  await testApp.app.inject({
    method: "POST",
    url: "/api/overviews",
    headers: { ...session.headers, [REQUEST_ID_HEADER]: "request-0001" },
    payload: storedOverview(),
  });

  const forRequest = linesFor(lines, "request-0001");
  const bound = forRequest.filter(({ msg }) => msg === "record written" || msg === "request completed");
  assert.equal(bound.length, 2);
  for (const line of bound) {
    assert.equal(line.accountId, session.accountId);
    assert.equal(typeof line.sessionId, "string");
    assert.equal(line.clientVersion, Number(session.headers["x-client-version"]));
  }
  await testApp.close();
});

test("one account's two devices are told apart by their sessions, and sign-in names the session it made", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  await testApp.app.inject({ method: "POST", url: "/api/auth/magic-link", payload: { email: EMAIL, surface: "web" } });
  await testApp.app.inject({ method: "POST", url: "/api/auth/sign-in", payload: { token: testApp.mailer.lastToken() } });
  const phone = await makeSession(testApp.sql, { email: EMAIL, now: testApp.clock.now });
  const laptop = await makeSession(testApp.sql, { email: EMAIL, now: testApp.clock.now });

  for (const [device, reqId] of [[phone, "request-phone"], [laptop, "request-laptop"]] as const) {
    await testApp.app.inject({ method: "GET", url: "/api/changes", headers: { ...device.headers, [REQUEST_ID_HEADER]: reqId } });
  }

  const created = lines.find(({ msg }) => msg === "session created")!;
  const [phoneFeed] = linesFor(lines, "request-phone").filter(({ msg }) => msg === "changes served");
  const [laptopFeed] = linesFor(lines, "request-laptop").filter(({ msg }) => msg === "changes served");
  assert.equal(phoneFeed!.accountId, created.accountId);
  assert.equal(laptopFeed!.accountId, created.accountId);
  assert.equal(new Set([created.sessionId, phoneFeed!.sessionId, laptopFeed!.sessionId]).size, 3);
  assert.doesNotMatch(JSON.stringify(lines), /reader@example\.com/);
  await testApp.close();
});
