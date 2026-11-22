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

test("a TikTok link comes back as its video", async () => {
  const testApp = await appOver();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "read", video: TIKTOK_VIDEO });
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

test("without the vendor's key, both routes say TikTok isn't read here", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const read = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });
  const words = await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { url: VIDEO_URL } });

  assert.equal(read.json().error.code, "unavailable");
  assert.equal(words.json().error.code, "unavailable");
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
  for (let n = 0; n <= TRIAL_READS; n += 1) answered.push(await device.readTikTok(LINK));

  assert.equal(unknown.statusCode, 401);
  assert.equal(answered[0]!.json().status, "read");
  assert.equal(answered.at(-1)!.statusCode, 429);
  assert.equal(answered.at(-1)!.json().error.details.quota, "trial-reads");
  await testApp.close();
});

test("each vendor credit lands in the cost tally, on the account or on no one yet", async () => {
  const testApp = await appOver();
  const account = await makeAccount(testApp);
  const device = await makeTrialDevice(testApp);

  await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });
  await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { url: VIDEO_URL } });
  await device.readTikTok(LINK);

  const [onAccount] = await vendorCosts(testApp, "account_costs");
  const [signedOut] = await vendorCosts(testApp, "signed_out_costs");
  assert.equal(onAccount?.quantity, 2);
  assert.ok((onAccount?.dollars ?? 0) > 0);
  assert.equal(signedOut?.quantity, 1);
  await testApp.close();
});

test("an account gets the video's words as its own transcript", async () => {
  const testApp = await appOver();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { url: VIDEO_URL } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().videoId, `tiktok:${VIDEO_ID}`);
  assert.equal(response.json().generated, true);
  assert.equal(response.json().segments.length, 3);
  await testApp.close();
});

test("signed out, a trial can't fetch a TikTok's words", async () => {
  const testApp = await appOver();
  const device = await makeTrialDevice(testApp);

  const response = await device.tiktokTranscript(VIDEO_URL);

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("a video with no captions answers transcript_unavailable with the failure named", async () => {
  const testApp = await appOver(found(TIKTOK_VIDEO, null));
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { url: VIDEO_URL } });

  assert.equal(response.json().error.code, "transcript_unavailable");
  assert.equal(response.json().error.details.failure, "no-captions");
  await testApp.close();
});

test("an address that isn't a TikTok video is refused before the vendor is asked", async () => {
  const testApp = await appOver();
  const account = await makeAccount(testApp);

  const profile = await account.inject({
    method: "POST",
    url: "/api/tiktok/transcript",
    body: { url: "https://www.tiktok.com/@anewsroom" },
  });
  const other = await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { url: "https://example.com/video/1" } });

  assert.equal(profile.statusCode, 400);
  assert.equal(other.statusCode, 400);
  await testApp.close();
});

test("the log says the link's shape, how it went and what it cost, and never the link, the handle or the video", async () => {
  const { logger, lines } = recordingLogger();
  const testApp = await appOver(found(), logger);
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });
  await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { url: VIDEO_URL } });

  const [read] = saying(lines, "tiktok video read");
  const [transcript] = saying(lines, "tiktok transcript resolved");
  assert.equal(read?.link, "video");
  assert.equal(read?.outcome, "read");
  assert.equal(read?.captions, 1);
  assert.equal(read?.credits, 1);
  assert.equal(transcript?.source, "ASR");
  assert.equal(transcript?.segments, 3);
  assert.equal(transcript?.credits, 1);
  const logged = JSON.stringify(lines);
  assert.ok(!logged.includes(VIDEO_ID) && !logged.includes("anewsroom"));
  await testApp.close();
});
