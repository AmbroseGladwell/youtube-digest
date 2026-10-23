import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { setAccountPlan } from "../auth/setAccountPlan.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";

test("an account reads both of this month's counts, with their limits and the reset date", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const usage = new OverviewUsageRepository(testApp.sql);
  await usage.reserve(testApp.clock.now, account.accountId, "ours", 5);
  await usage.reserve(testApp.clock.now, account.accountId, "own", 10);
  await usage.reserve(testApp.clock.now, account.accountId, "own", 10);

  const response = await account.inject({ method: "GET", url: "/api/overview-usage" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    plan: "free",
    resetsOn: "2026-10-01",
    ours: { used: 1, limit: 5 },
    own: { used: 2, limit: 10 },
  });
  await testApp.close();
});

test("a BYO Plus account reads BYO Plus's limits", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const [row] = await testApp.sql.query<{ email: string }>("select email from accounts where id = $1", [account.accountId]);
  await setAccountPlan(testApp.sql, row!.email, "byo-plus");

  const response = await account.inject({ method: "GET", url: "/api/overview-usage" });

  assert.equal(response.json().plan, "byo-plus");
  assert.deepEqual([response.json().ours.limit, response.json().own.limit], [10, 200]);
  await testApp.close();
});

test("the counts are an account's, so a signed-out caller is refused", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "GET",
    url: "/api/overview-usage",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });

  assert.equal(response.json().error.code, "unauthenticated");
  await testApp.close();
});
