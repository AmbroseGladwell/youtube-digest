import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

test("the feed pages in seq order, says whether there is more, and hands back where to resume", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overviews = [storedOverview(), storedOverview(), storedOverview()];
  for (const overview of overviews) {
    await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  }

  const first = await account.changes(0, 2);
  assert.deepEqual(first.changes.map((change) => change.id), [overviews[0]!.id, overviews[1]!.id]);
  assert.equal(first.more, true);
  assert.equal(first.next, 2);

  const rest = await account.changes(first.next, 2);
  assert.deepEqual(rest.changes.map((change) => change.id), [overviews[2]!.id]);
  assert.equal(rest.more, false);
  assert.equal(rest.next, 3);

  const nothing = await account.changes(rest.next);
  assert.deepEqual(nothing, { changes: [], next: 3, more: false });
  await testApp.close();
});

test("a record written twice appears once, at its latest seq, after the earlier one", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const [first, second] = [storedOverview(), storedOverview()];
  await account.inject({ method: "POST", url: "/api/overviews", body: first });
  await account.inject({ method: "POST", url: "/api/overviews", body: second });
  await account.inject({ method: "POST", url: "/api/overviews", body: first, ifMatch: 1 });

  const { changes } = await account.changes();

  assert.deepEqual(changes.map((change) => [change.id, change.seq, change.rev]), [
    [second.id, 2, 1],
    [first.id, 3, 2],
  ]);
  await testApp.close();
});

test("one account never sees another account's records", async () => {
  const testApp = await createTestApp();
  const mine = await makeAccount(testApp);
  const theirs = await makeAccount(testApp);
  await mine.inject({ method: "POST", url: "/api/overviews", body: storedOverview() });

  assert.equal((await theirs.changes()).changes.length, 0);
  assert.equal((await mine.changes()).changes.length, 1);
  await testApp.close();
});

test("updatedAt is the client's stamp, normalised to UTC, and the server's own stored time is never exposed", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();

  await account.inject({
    method: "POST",
    url: "/api/overviews",
    body: { ...overview, updatedAt: "2026-09-26T10:30:00.000+01:00" },
  });

  const change = await account.change("overview", overview.id);
  assert.equal(change.updatedAt, "2026-09-26T09:30:00.000Z");
  assert.equal("storedAt" in change, false);
  assert.equal("stored_at" in change, false);
  await testApp.close();
});

test("a bad query is refused rather than answered with everything", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "GET", url: "/api/changes?limit=0" });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});
