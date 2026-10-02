import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as waitForReports } from "node:timers/promises";
import { ApiErrorEnvelope, REQUEST_ID_HEADER } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

test("an unknown /api route is a 404 in the envelope", async () => {
  const { app, close } = await createTestApp();
  const response = await app.inject({ method: "POST", url: "/api/nowhere" });

  assert.equal(response.statusCode, 404);
  assert.doesNotThrow(() => ApiErrorEnvelope.parse(response.json()));
  await close();
});

const databaseFailsPastSignIn = (testApp: Awaited<ReturnType<typeof createTestApp>>) => {
  const { query } = testApp.sql;
  testApp.sql.query = async (text, params) => {
    if (text.includes("sessions")) return query(text, params);
    throw new Error("Connection terminated unexpectedly");
  };
};

test("an error the server didn't expect is reported as its own, under the call's id, route and reader", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  databaseFailsPastSignIn(testApp);

  const response = await account.inject({ method: "GET", url: "/api/changes" });

  assert.equal(response.statusCode, 500);
  assert.equal(response.json().error.code, "internal_error");
  await waitForReports();
  assert.equal(testApp.errorSink.serverErrors.length, 1);
  assert.deepEqual(testApp.errorSink.serverErrors[0]!.request, {
    id: response.headers[REQUEST_ID_HEADER],
    method: "GET",
    route: "/api/changes",
    status: 500,
    accountId: account.accountId,
  });
  assert.equal(testApp.errorSink.serverErrors[0]!.caughtBy, "request");
  await testApp.close();
});

test("an answer the server meant to give, such as a 4xx, is not reported as an error", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  await testApp.app.inject({ method: "POST", url: "/api/nowhere" });
  await account.inject({ method: "GET", url: "/api/changes?since=not-a-number" });
  await testApp.app.inject({ method: "GET", url: "/api/changes" });

  await waitForReports();
  assert.deepEqual(testApp.errorSink.serverErrors, []);
  await testApp.close();
});

test("an error under /mcp is reported the same way", async () => {
  const testApp = await createTestApp();
  databaseFailsPastSignIn(testApp);

  const response = await testApp.app.inject({
    method: "POST",
    url: "/mcp",
    headers: { authorization: "Bearer some-access-token" },
    payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });

  assert.equal(response.statusCode, 500);
  await waitForReports();
  assert.equal(testApp.errorSink.serverErrors[0]!.request?.route, "/mcp");
  await testApp.close();
});

test("the tracker being down changes nothing about the answer", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  databaseFailsPastSignIn(testApp);
  testApp.errorSink.failing = true;

  const response = await account.inject({ method: "GET", url: "/api/changes" });

  assert.equal(response.statusCode, 500);
  assert.equal(response.json().error.code, "internal_error");
  await testApp.close();
});
