import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { FIRST_RESERVING_CLIENT_VERSION, schemaVersionsForClient, type Share } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";
import { generationRequest, makeFakeOpenAi } from "../generation/FakeOpenAi.testHelper.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { overviewQuotas } from "../usage/overviewQuotas.js";

const RESERVING = FIRST_RESERVING_CLIENT_VERSION;
const OUR_KEY = { apiKey: "sk-test-ours", dailyGenerations: 300, signedOutDailyGenerations: 50, http: makeFakeOpenAi().http };
const BEFORE_RESERVING = FIRST_RESERVING_CLIENT_VERSION - 1;

const fromBeforeReserving = () => ({ ...storedOverview(), schemaVersion: schemaVersionsForClient(BEFORE_RESERVING).overview });

const reserve = (account: TestAccount, overviewId: string, shareToken?: string) =>
  account.inject({
    method: "POST",
    url: "/api/overview-reservations",
    body: { overviewId, ...(shareToken === undefined ? {} : { shareToken }) },
    clientVersion: RESERVING,
  });

const release = (account: TestAccount, overviewId: string) =>
  account.inject({ method: "DELETE", url: `/api/overview-reservations/${overviewId}`, clientVersion: RESERVING });

const push = (account: TestAccount, overview: ReturnType<typeof storedOverview>, { ifMatch, clientVersion = RESERVING }: { ifMatch?: number; clientVersion?: number } = {}) =>
  account.inject({ method: "POST", url: "/api/overviews", body: overview, clientVersion, reserved: false, ...(ifMatch === undefined ? {} : { ifMatch }) });

const ownUsed = async (account: TestAccount): Promise<number> =>
  (await account.inject({ method: "GET", url: "/api/overview-usage" })).json().own.used;

test("reserving an overview on the reader's own key counts it once, and answers with the month's counts", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overviewId = randomUUID();

  const first = await reserve(account, overviewId);
  const retried = await reserve(account, overviewId);

  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.json().own, { used: 1, limit: overviewQuotas.free.own });
  assert.equal(retried.statusCode, 200);
  assert.equal(await ownUsed(account), 1);
  await testApp.close();
});

test("the 11th own-key overview in a month on Free is refused with which quota and the reset date", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  for (let made = 0; made < overviewQuotas.free.own; made += 1) await reserve(account, randomUUID());

  const eleventh = await reserve(account, randomUUID());

  assert.equal(eleventh.statusCode, 429);
  assert.equal(eleventh.json().error.code, "too_many_requests");
  assert.deepEqual(
    { quota: eleventh.json().error.details.quota, resetsOn: eleventh.json().error.details.resetsOn },
    { quota: "own", resetsOn: "2026-10-01" },
  );
  assert.ok(Number(eleventh.headers["retry-after"]) > 0);
  await testApp.close();
});

test("a generation that failed gives its slot back, and the overview can no longer be pushed as new", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await reserve(account, overview.id);

  const released = await release(account, overview.id);
  const pushed = await push(account, overview);

  assert.equal(released.statusCode, 204);
  assert.equal(await ownUsed(account), 0);
  assert.equal(pushed.statusCode, 428);
  assert.equal(pushed.json().error.code, "not_reserved");
  await testApp.close();
});

test("once its overview is pushed, a reservation can't be given back", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await reserve(account, overview.id);
  await push(account, overview);

  await release(account, overview.id);

  assert.equal(await ownUsed(account), 1);
  await testApp.close();
});

test("a reserving client's new overview with no reservation is refused and logged, and one with a reservation is let in", async () => {
  const { logger, lines } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const unreserved = storedOverview();
  const reserved = storedOverview();
  await reserve(account, reserved.id);

  const refused = await push(account, unreserved);
  const letIn = await push(account, reserved);

  assert.equal(refused.statusCode, 428);
  assert.equal(refused.json().error.code, "not_reserved");
  assert.equal(letIn.statusCode, 201);
  assert.equal(lines.filter((line) => line.msg === "new overview pushed without a reservation").length, 1);
  await testApp.close();
});

test("a client from before reservations still pushes new overviews, until the write floor passes it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await push(account, fromBeforeReserving(), { clientVersion: BEFORE_RESERVING });

  assert.equal(response.statusCode, 201);
  await testApp.close();
});

test("an overview the account already holds answers as it always did, reserved or not", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await push(account, { ...overview, schemaVersion: schemaVersionsForClient(BEFORE_RESERVING).overview }, { clientVersion: BEFORE_RESERVING });

  const again = await push(account, overview);
  const regenerated = await push(account, { ...overview, coreClaim: "A different claim." }, { ifMatch: 1 });

  assert.equal(again.json().error.code, "already_exists");
  assert.equal(regenerated.statusCode, 200);
  await testApp.close();
});

test("a regeneration's slot is spent once it is pushed, so it can't be given back afterwards", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await reserve(account, overview.id);
  await push(account, overview);
  await reserve(account, overview.id);
  await push(account, { ...overview, coreClaim: "A different claim." }, { ifMatch: 1 });

  await release(account, overview.id);

  assert.equal(await ownUsed(account), 2);
  await testApp.close();
});

test("an overview made on our key is let in, and an own-key slot still held for it is given back, so a fallback counts once", async () => {
  const testApp = await createTestApp({}, { ourKey: OUR_KEY });
  const account = await makeAccount(testApp);
  const overviewId = randomUUID();
  await reserve(account, overviewId);

  const made = await account.inject({ method: "POST", url: "/api/generations", body: generationRequest(overviewId), clientVersion: RESERVING });
  const pushed = await push(account, { ...storedOverview(), ...made.json() });
  const usage = (await account.inject({ method: "GET", url: "/api/overview-usage" })).json();

  assert.equal(made.statusCode, 200);
  assert.equal(pushed.statusCode, 201);
  assert.deepEqual([usage.ours.used, usage.own.used], [1, 0]);
  await testApp.close();
});

test("an overview made on our key in a signed-out trial and moved in on sign-in counts on the account's month on our key", async () => {
  const testApp = await createTestApp({}, { ourKey: OUR_KEY });
  const device = await makeTrialDevice(testApp);
  const overviewId = randomUUID();
  const made = await device.generate(overviewId);
  const account = await makeAccount(testApp);

  const refused = await push(account, { ...storedOverview(), ...made.json() });
  const reserved = await reserve(account, overviewId);
  const pushed = await push(account, { ...storedOverview(), ...made.json() });

  assert.equal(refused.json().error.code, "not_reserved");
  assert.equal(reserved.statusCode, 200);
  assert.deepEqual([reserved.json().ours.used, reserved.json().own.used], [1, 0]);
  assert.equal(pushed.statusCode, 201);
  await testApp.close();
});

test("a moved trial overview with the month on our key spent waits for the month, as an own-key one does", async () => {
  const testApp = await createTestApp({}, { ourKey: OUR_KEY });
  const account = await makeAccount(testApp);
  for (let made = 0; made < overviewQuotas.free.ours; made += 1) {
    await account.inject({ method: "POST", url: "/api/generations", body: generationRequest(randomUUID()) });
  }
  const overviewId = randomUUID();
  await (await makeTrialDevice(testApp)).generate(overviewId);

  const waiting = await reserve(account, overviewId);

  assert.equal(waiting.statusCode, 429);
  assert.deepEqual([waiting.json().error.details.quota, waiting.json().error.details.resetsOn], ["ours", "2026-10-01"]);
  await testApp.close();
});

test("saving a live share of an overview lets it in without counting it", async () => {
  const testApp = await createTestApp();
  const sharer = await makeAccount(testApp);
  const reader = await makeAccount(testApp);
  const shared = makeOverview();
  const share: Share = (await sharer.inject({ method: "POST", url: "/api/shares", body: { overview: shared } })).json();

  const saved = await reserve(reader, shared.id, share.token);
  const pushed = await push(reader, { ...storedOverview(), id: shared.id });

  assert.equal(saved.statusCode, 200);
  assert.equal(pushed.statusCode, 201);
  assert.equal(await ownUsed(reader), 0);
  await testApp.close();
});

test("a share token is no way in for a different overview, or once the link is stopped", async () => {
  const testApp = await createTestApp();
  const sharer = await makeAccount(testApp);
  const reader = await makeAccount(testApp);
  const shared = makeOverview();
  const share: Share = (await sharer.inject({ method: "POST", url: "/api/shares", body: { overview: shared } })).json();

  const other = await reserve(reader, randomUUID(), share.token);
  await sharer.inject({ method: "DELETE", url: `/api/shares/${share.token}` });
  const stopped = await reserve(reader, shared.id, share.token);

  assert.equal(other.json().error.code, "not_found");
  assert.equal(stopped.json().error.code, "not_found");
  await testApp.close();
});

test("reservations are an account's, so a signed-out caller is refused", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/overview-reservations",
    headers: { "x-client-version": String(RESERVING) },
    payload: { overviewId: randomUUID() },
  });

  assert.equal(response.json().error.code, "unauthenticated");
  await testApp.close();
});
