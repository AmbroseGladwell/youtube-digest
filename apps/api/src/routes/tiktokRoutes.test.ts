import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_READS } from "@overview/domain";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import type { VendorVideo } from "../tiktok/createScrapeCreatorsTikTok.js";
import { makeScriptedTranscriber, transcribedAudio } from "../podcasts/ScriptedTranscriber.testHelper.js";
import type { Transcriber } from "../podcasts/Transcriber.js";
import { usageMonth } from "../usage/usageMonth.js";
import { createTikTokReader } from "../tiktok/createTikTokReader.js";
import { SMALLEST_MEDIA_URL, VIDEO_ID, VIDEO_URL } from "../tiktok/ScrapeCreatorsAnswerFactory.testHelper.js";
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

const NO_CAPTIONS = found({ ...TIKTOK_VIDEO, captions: [] }, null);
const TRANSCRIPTION_PATH = "/api/tiktok/transcription";

const transcribingApp = (answer: VendorVideo = NO_CAPTIONS, transcriber: Transcriber = makeScriptedTranscriber()) => {
  const scripted = scriptedTikTokVendor(answer);
  return createTestApp({}, { tiktokReader: createTikTokReader({ vendor: scripted.vendor }), transcriber }).then((testApp) => ({
    testApp,
    asked: scripted.asked,
  }));
};

test("a TikTok with no captions is offered to transcribe, on the month's hours, only when we can", async () => {
  const { testApp } = await transcribingApp();
  const account = await makeAccount(testApp);
  const withoutStt = await appOver(NO_CAPTIONS);
  const elsewhere = await makeAccount(withoutStt);
  const captioned = await transcribingApp(found());
  const captionedAccount = await makeAccount(captioned.testApp);

  const offered = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });
  const notOffered = await elsewhere.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });
  const withWords = await captionedAccount.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.deepEqual(offered.json().transcription, {
    status: "needed",
    episodeSeconds: 80,
    usage: { usedSeconds: 0, limitSeconds: 5 * 3600, episodes: 0 },
  });
  assert.equal(notOffered.json().transcription, undefined);
  assert.equal(withWords.json().transcription, undefined);
  await Promise.all([testApp.close(), withoutStt.close(), captioned.testApp.close()]);
});

test("asked to, our server reads the TikTok afresh and transcribes its smallest file, then hands back the words", async () => {
  const transcriber = makeScriptedTranscriber([{ state: "running" }, { state: "done", result: transcribedAudio({ audioSeconds: 79.6 }) }]);
  const { testApp, asked } = await transcribingApp(NO_CAPTIONS, transcriber);
  const account = await makeAccount(testApp);

  const started = await account.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: LINK } });
  await testApp.drainTranscriptions();
  const ready = await account.inject({ method: "GET", url: `${TRANSCRIPTION_PATH}/${started.json().id}` });
  const again = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.equal(started.statusCode, 200);
  assert.equal(started.json().status, "waiting");
  assert.equal(started.json().episodeSeconds, 80);
  assert.deepEqual(asked.at(0), { url: VIDEO_URL, withTranscript: false });
  assert.equal(transcriber.submitted[0]?.audioUrl, SMALLEST_MEDIA_URL);
  assert.equal(ready.json().status, "ready");
  assert.equal(ready.json().transcript.videoId, `tiktok:${VIDEO_ID}`);
  assert.equal(ready.json().transcript.segments.length, 2);
  assert.deepEqual(again.json().transcription, { status: "free", why: "transcribed" });
  assert.equal(
    (await vendorCosts(testApp, "account_costs")).reduce((sum, row) => sum + row.quantity, 0),
    2,
  );
  await testApp.close();
});

test("transcribing a TikTok needs an account, the host, a video that reads, and hours left", async () => {
  const { testApp } = await transcribingApp();
  const account = await makeAccount(testApp);
  const withoutStt = await appOver(NO_CAPTIONS);
  const elsewhere = await makeAccount(withoutStt);
  const gone = await transcribingApp({ status: "failed", reason: "unavailable", credits: 0, vendorStatus: 404 });
  const goneAccount = await makeAccount(gone.testApp);
  const silent = await transcribingApp(found({ ...TIKTOK_VIDEO, captions: [] }, null, null));
  const silentAccount = await makeAccount(silent.testApp);
  const long = await transcribingApp(found({ ...TIKTOK_VIDEO, captions: [], durationSeconds: 6 * 3600 }, null));
  const longAccount = await makeAccount(long.testApp);

  const signedOut = await testApp.app.inject({
    method: "POST",
    url: TRANSCRIPTION_PATH,
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { url: LINK },
  });
  const noHost = await elsewhere.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: LINK } });
  const unread = await goneAccount.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: LINK } });
  const noSound = await silentAccount.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: LINK } });
  const tooLong = await longAccount.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: LINK } });
  await testApp.sql.query("insert into transcription_usage (month, caller, account_id, seconds) values ($1::date, $2, $3, $4)", [
    usageMonth(testApp.clock.now),
    `account:${account.accountId}`,
    account.accountId,
    5 * 3600 - 10,
  ]);
  const spent = await account.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: LINK } });

  assert.equal(signedOut.json().error.code, "unauthenticated");
  assert.equal(noHost.json().error.code, "unavailable");
  assert.deepEqual([unread.json().error.code, unread.json().error.details], ["transcript_unavailable", { tiktok: "unavailable" }]);
  assert.deepEqual(noSound.json().error.details, { transcription: "no-audio" });
  assert.deepEqual(tooLong.json().error.details, { transcription: "too-long", episodeSeconds: 6 * 3600 });
  assert.equal(spent.statusCode, 429);
  assert.equal(spent.json().error.details.quota, "transcription");
  await Promise.all([testApp.close(), withoutStt.close(), gone.testApp.close(), silent.testApp.close(), long.testApp.close()]);
});

test("one account can't see another's TikTok transcription", async () => {
  const { testApp } = await transcribingApp();
  const owner = await makeAccount(testApp);
  const other = await makeAccount(testApp);

  const started = await owner.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: LINK } });
  const peek = await other.inject({ method: "GET", url: `${TRANSCRIPTION_PATH}/${started.json().id}` });

  assert.equal(peek.json().error.code, "not_found");
  await testApp.close();
});
