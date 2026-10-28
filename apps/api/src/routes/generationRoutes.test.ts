import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_OVERVIEWS, TRIAL_TOKEN_HEADER } from "@overview/domain";
import { generationRequest, makeFakeOpenAi, type FakeOpenAi } from "../generation/FakeOpenAi.testHelper.js";
import { ourKeyModel } from "../generation/ourKeyModel.js";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";
import { overviewQuotas } from "../usage/overviewQuotas.js";
import { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";
import { TRIAL_OVERVIEWS_PER_ADDRESS_DAILY } from "../usage/TrialsRepository.js";

const OUR_KEY = "sk-test-ours";

async function ourKeyApp(
  openAi: FakeOpenAi,
  {
    dailyGenerations = 300,
    signedOutDailyGenerations = 50,
    logger,
  }: { dailyGenerations?: number; signedOutDailyGenerations?: number; logger?: ReturnType<typeof recordingLogger>["logger"] } = {},
) {
  return createTestApp(
    {},
    { ourKey: { apiKey: OUR_KEY, dailyGenerations, signedOutDailyGenerations, http: openAi.http }, ...(logger === undefined ? {} : { logger }) },
  );
}

const generate = (account: TestAccount) =>
  account.inject({ method: "POST", url: "/api/generations", body: generationRequest(randomUUID()) });

const usageOf = async (account: TestAccount) => (await account.inject({ method: "GET", url: "/api/overview-usage" })).json();

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("a signed-in reader with no key gets an overview made on our key with Sol, and it counts once on our key", async () => {
  const openAi = makeFakeOpenAi();
  const testApp = await ourKeyApp(openAi);
  const account = await makeAccount(testApp);
  const request = generationRequest(randomUUID());

  const response = await account.inject({ method: "POST", url: "/api/generations", body: request });
  const usage = await usageOf(account);

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, request.overviewId);
  assert.equal(response.json().inOneLine, "A short description.");
  assert.deepEqual(openAi.requests.map((sent) => [sent.model, sent.authorization]), [[ourKeyModel.model, `Bearer ${OUR_KEY}`]]);
  assert.deepEqual([usage.ours.used, usage.own.used], [1, 0]);
  await testApp.close();
});

test("regenerating counts again, because it costs the same again", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  const account = await makeAccount(testApp);
  const request = generationRequest(randomUUID());

  await account.inject({ method: "POST", url: "/api/generations", body: request });
  await account.inject({ method: "POST", url: "/api/generations", body: request });

  assert.equal((await usageOf(account)).ours.used, 2);
  await testApp.close();
});

test("the 6th on our key in a month on Free is refused with which quota and the reset date", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  const account = await makeAccount(testApp);
  for (let made = 0; made < overviewQuotas.free.ours; made += 1) await generate(account);

  const sixth = await generate(account);

  assert.equal(sixth.statusCode, 429);
  assert.equal(sixth.json().error.code, "too_many_requests");
  assert.deepEqual(
    { quota: sixth.json().error.details.quota, resetsOn: sixth.json().error.details.resetsOn },
    { quota: "ours", resetsOn: "2026-10-01" },
  );
  assert.ok(Number(sixth.headers["retry-after"]) > 0);
  await testApp.close();
});

test("a failed generation gives back both its month's slot and its day's slot", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi({ status: 503, body: { error: { message: "overloaded" } } }));
  const account = await makeAccount(testApp);

  const response = await generate(account);

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error.code, "generation_failed");
  assert.equal((await usageOf(account)).ours.used, 0);
  assert.equal(await new OverviewUsageRepository(testApp.sql).ourKeyGenerationsOn(usageDay(testApp.clock.now)), 0);
  await testApp.close();
});

test("each failure says whether it may move to the next key", async () => {
  const cases = [
    [{ status: 503, body: { error: { message: "overloaded" } } }, "provider-down"],
    [{ status: 429, body: { error: { type: "insufficient_quota", code: "insufficient_quota" } } }, "out-of-credit"],
    ["invalid", "schema-failure"],
    [{ status: 400, body: { error: { message: "bad request" } } }, null],
  ] as const;
  for (const [answer, fallback] of cases) {
    const testApp = await ourKeyApp(makeFakeOpenAi(answer));
    const account = await makeAccount(testApp);

    const response = await generate(account);

    assert.equal(response.json().error.details.fallback, fallback, JSON.stringify(answer));
    await testApp.close();
  }
});

test("our own key refused by OpenAI is ours to fix: the reader is told it's unavailable and nothing counts", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi({ status: 401, body: { error: { message: "Incorrect API key" } } }), { logger });
  const account = await makeAccount(testApp);

  const response = await generate(account);

  assert.equal(response.json().error.code, "unavailable");
  assert.equal((await usageOf(account)).ours.used, 0);
  assert.equal(saying(lines, "our key refused").length, 1);
  await testApp.close();
});

test("the global daily cap refuses every plan once spent, and turns with the UTC day", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi(), { dailyGenerations: 1 });
  const first = await makeAccount(testApp);
  const second = await makeAccount(testApp);
  await generate(first);

  const refused = await generate(second);
  const usedWhenRefused = (await usageOf(second)).ours.used;
  testApp.clock.advance(24 * 60 * 60 * 1000);
  const nextDay = await generate(second);

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "our-key-daily");
  assert.equal(usedWhenRefused, 0);
  assert.equal(nextDay.statusCode, 200);
  await testApp.close();
});

test("a generation logs its tokens and cost, measured from what OpenAI reported", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { logger });
  const account = await makeAccount(testApp);

  await generate(account);
  const [made] = saying(lines, "overview made on our key");

  assert.equal(made?.plan, "free");
  assert.equal(made?.model, ourKeyModel.model);
  assert.deepEqual([made?.inputTokens, made?.outputTokens], [1200, 300]);
  assert.equal(made?.costDollars, (1000 * 2 + 200 * 0.1 + 300 * 10) / 1_000_000);
  await testApp.close();
});

test("a server with no key of its own says so before anyone asks it to generate", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const status = await testApp.app.inject({
    method: "GET",
    url: "/api/generations",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });
  const refused = await generate(account);

  assert.deepEqual(status.json(), { available: false });
  assert.equal(refused.json().error.code, "unavailable");
  await testApp.close();
});

test("making an overview on our key needs an account or a trial", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/generations",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: generationRequest(randomUUID()),
  });

  assert.equal(response.json().error.code, "unauthenticated");
  await testApp.close();
});

const DAY_MS = 24 * 60 * 60 * 1000;

test("signed out, a device makes its one onboarding overview on our key on its token, and the next is refused as the trial's", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  const device = await makeTrialDevice(testApp);

  const made = [];
  for (let n = 0; n < TRIAL_OVERVIEWS; n += 1) made.push((await device.generate()).statusCode);
  const next = await device.generate();

  assert.deepEqual(made, [200]);
  assert.equal(next.statusCode, 429);
  assert.equal(next.json().error.details.quota, "trial");
  await testApp.close();
});

test("a new token from the same address gets no more on our key that day, while another address does", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { logger });
  for (let n = 0; n < TRIAL_OVERVIEWS_PER_ADDRESS_DAILY; n += 1) await (await makeTrialDevice(testApp)).generate();

  const privateWindow = await makeTrialDevice(testApp);
  const refused = await privateWindow.generate();
  const elsewhere = await (await makeTrialDevice(testApp, "198.51.100.4")).generate();
  testApp.clock.advance(DAY_MS);
  const tomorrow = await privateWindow.generate();

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "trial-address");
  assert.ok(Number(refused.headers["retry-after"]) > 0);
  assert.equal(elsewhere.statusCode, 200);
  assert.equal(tomorrow.statusCode, 200);
  assert.equal(saying(lines, "trial address cap spent").length, 1);
  assert.ok(!JSON.stringify(lines).includes("203.0.113.7"));
  await testApp.close();
});

test("a refusal from the address doesn't spend the token's own trial", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());
  for (let n = 0; n < TRIAL_OVERVIEWS_PER_ADDRESS_DAILY; n += 1) await (await makeTrialDevice(testApp)).generate();
  const device = await makeTrialDevice(testApp);
  await device.generate();

  testApp.clock.advance(DAY_MS);
  const made = [];
  for (let n = 0; n < TRIAL_OVERVIEWS; n += 1) made.push((await device.generate()).statusCode);

  assert.deepEqual(made, [200]);
  await testApp.close();
});

test("once the signed-out share of the day is spent, a trial is refused as busy while an account still makes one", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { signedOutDailyGenerations: 1, logger });
  await (await makeTrialDevice(testApp)).generate();

  const refused = await (await makeTrialDevice(testApp, "198.51.100.4")).generate();
  const account = await generate(await makeAccount(testApp));

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.quota, "our-key-daily");
  assert.equal(account.statusCode, 200);
  assert.equal(saying(lines, "our key signed-out share spent").length, 1);
  await testApp.close();
});

test("a failed trial generation gives back its token's slot, its address's and the signed-out share", async () => {
  const openAi = makeFakeOpenAi({ status: 503, body: { error: { message: "overloaded" } } });
  const testApp = await ourKeyApp(openAi, { signedOutDailyGenerations: 1 });
  const device = await makeTrialDevice(testApp);

  for (let n = 0; n < TRIAL_OVERVIEWS + 1; n += 1) await device.generate();
  const usage = new OverviewUsageRepository(testApp.sql);
  const day = usageDay(testApp.clock.now);

  assert.equal((await device.generate()).json().error.code, "generation_failed");
  assert.deepEqual([await usage.ourKeyGenerationsOn(day), await usage.signedOutGenerationsOn(day)], [0, 0]);
  await testApp.close();
});

test("a token this server never issued is told so, so the device can ask for a new one", async () => {
  const testApp = await ourKeyApp(makeFakeOpenAi());

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/generations",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), [TRIAL_TOKEN_HEADER]: "never-issued" },
    payload: generationRequest(randomUUID()),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.details.trial, "unknown");
  assert.equal(await new OverviewUsageRepository(testApp.sql).ourKeyGenerationsOn(usageDay(testApp.clock.now)), 0);
  await testApp.close();
});

test("a trial overview logs as the trial's, with the token's count", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await ourKeyApp(makeFakeOpenAi(), { logger });
  const device = await makeTrialDevice(testApp);

  await device.generate();
  const [made] = saying(lines, "overview made on our key");

  assert.deepEqual([made?.caller, made?.plan, made?.used, made?.limit], ["trial", null, 1, TRIAL_OVERVIEWS]);
  assert.equal(saying(lines, "trial token issued").length, 1);
  assert.ok(!JSON.stringify(lines).includes(device.token));
  await testApp.close();
});

test("a server with no key of its own issues no trials", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/trials",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });

  assert.equal(response.json().error.code, "unavailable");
  await testApp.close();
});
