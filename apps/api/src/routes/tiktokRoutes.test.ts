import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_READS } from "@overview/domain";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import type { VendorVideo } from "../tiktok/createScrapeCreatorsTikTok.js";
import { createTikTokReader } from "../tiktok/createTikTokReader.js";
import { VIDEO_ID, VIDEO_URL } from "../tiktok/ScrapeCreatorsAnswerFactory.testHelper.js";
import { found, scriptedTikTokVendor, TIKTOK_VIDEO } from "../tiktok/ScriptedTikTokVendor.testHelper.js";

const LINK = `${VIDEO_URL}?is_from_webapp=1`;

const appOver = (answer: VendorVideo = found(), logger?: ReturnType<typeof recordingLogger>["logger"]) =>
  createTestApp(
    {},
    { tiktokReader: createTikTokReader({ vendor: scriptedTikTokVendor(answer).vendor }), ...(logger === undefined ? {} : { logger }) },
  );

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

const vendorCosts = async ({ sql }: TestApp, table: "account_costs" | "signed_out_costs") =>
  sql.query<{ quantity: number; dollars: number }>(
    `select quantity::float8 as quantity, dollars::float8 as dollars from ${table} where area = 'transcripts' and detail = 'tiktok-vendor'`,
  );

test("a TikTok link comes back as its video and its words, as the account's own transcript", async () => {
  const testApp = await appOver();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "read");
  assert.deepEqual(response.json().video, TIKTOK_VIDEO);
  assert.equal(response.json().transcript.videoId, `tiktok:${VIDEO_ID}`);
  assert.equal(response.json().transcript.generated, true);
  assert.equal(response.json().transcript.segments.length, 3);
  await testApp.close();
});

test("a video with no captions is read, with no words", async () => {
  const testApp = await appOver(found(TIKTOK_VIDEO, null));
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.deepEqual(response.json(), { status: "read", video: TIKTOK_VIDEO, transcript: null });
  await testApp.close();
});

test("a link that can't be read answers with why, not an error", async () => {
  const testApp = await appOver({ status: "failed", reason: "unavailable", credits: 0, vendorStatus: 404 });
  const account = await makeAccount(testApp);

  const notAVideo = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: "https://www.tiktok.com/@anewsroom" } });
  const gone = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.deepEqual(notAVideo.json(), { status: "failed", reason: "not-a-video" });
  assert.deepEqual(gone.json(), { status: "failed", reason: "unavailable" });
  await testApp.close();
});

test("without the vendor's key, the read says TikTok isn't read here", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const read = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.equal(read.json().error.code, "unavailable");
  await testApp.close();
});

test("signed out, only a trial can ask our server to read a TikTok link, within the trial's reads", async () => {
  const testApp = await appOver();
  const device = await makeTrialDevice(testApp);

  const unknown = await testApp.app.inject({
    method: "POST",
    url: "/api/tiktok/read",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { url: LINK },
  });
  const answered = [];
  for (let n = 0; n <= TRIAL_READS; n += 1) {
    answered.push(await device.readTikTok(LINK));
  }

  assert.equal(unknown.statusCode, 401);
  assert.equal(answered[0]!.json().status, "read");
  assert.equal(answered.at(-1)!.statusCode, 429);
  assert.equal(answered.at(-1)!.json().error.details.quota, "trial-reads");
  await testApp.close();
});

test("each vendor credit lands in the cost tally, on the account or on no one yet, one a read", async () => {
  const testApp = await appOver();
  const account = await makeAccount(testApp);
  const device = await makeTrialDevice(testApp);

  await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });
  await device.readTikTok(LINK);

  const [onAccount] = await vendorCosts(testApp, "account_costs");
  const [signedOut] = await vendorCosts(testApp, "signed_out_costs");
  assert.equal(onAccount?.quantity, 1);
  assert.ok((onAccount?.dollars ?? 0) > 0);
  assert.equal(signedOut?.quantity, 1);
  await testApp.close();
});

test("the log says the link's shape, how it went and what it cost, and never the link, the handle or the video", async () => {
  const { logger, lines } = recordingLogger();
  const testApp = await appOver(found(), logger);
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  const [read] = saying(lines, "tiktok video read");
  assert.equal(read?.link, "video");
  assert.equal(read?.outcome, "read");
  assert.equal(read?.captions, 1);
  assert.equal(read?.segments, 3);
  assert.equal(read?.credits, 1);
  const logged = JSON.stringify(lines);
  assert.ok(!logged.includes(VIDEO_ID) && !logged.includes("anewsroom") && !logged.includes("real chance"));
  await testApp.close();
});
