import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_READS } from "@overview/domain";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { makeScriptedTranscriber, transcribedAudio } from "../podcasts/ScriptedTranscriber.testHelper.js";
import type { Transcriber } from "../podcasts/Transcriber.js";
import type { VendorPost } from "../social/createScrapeCreatorsSocial.js";
import { createSocialPostReader } from "../social/createSocialPostReader.js";
import {
  FACEBOOK_LINK,
  FACEBOOK_SD_URL,
  FACEBOOK_VIDEO_ID,
  INSTAGRAM_VIDEO_URL,
  REEL_LINK,
  SHORTCODE,
} from "../social/SocialAnswerFactory.testHelper.js";
import {
  captionedFacebookVideo,
  FACEBOOK_VIDEO,
  foundPost,
  INSTAGRAM_PHOTO_POST,
  INSTAGRAM_REEL,
  scriptedSocialVendor,
} from "../social/ScriptedSocialVendor.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";

const READ_PATH = "/api/social/read";
const TRANSCRIPTION_PATH = "/api/social/transcription";

const appOver = (answer: VendorPost = foundPost(), logger?: ReturnType<typeof recordingLogger>["logger"]) =>
  createTestApp(
    {},
    { socialReader: createSocialPostReader({ vendor: scriptedSocialVendor(answer).vendor }), ...(logger === undefined ? {} : { logger }) },
  );

const transcribingApp = (answer: VendorPost = foundPost(), transcriber: Transcriber = makeScriptedTranscriber()) => {
  const scripted = scriptedSocialVendor(answer);
  return createTestApp({}, { socialReader: createSocialPostReader({ vendor: scripted.vendor }), transcriber }).then((testApp) => ({
    testApp,
    asked: scripted.asked,
  }));
};

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

const vendorCredits = async ({ sql }: TestApp, table: "account_costs" | "signed_out_costs") =>
  (
    await sql.query<{ quantity: number }>(
      `select quantity::float8 as quantity from ${table} where area = 'transcripts' and detail = 'social-vendor'`,
    )
  ).reduce((sum, row) => sum + row.quantity, 0);

test("an Instagram reel comes back as its post, with no words of its own, offered to transcribe", async () => {
  const { testApp, asked } = await transcribingApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: READ_PATH, body: { url: REEL_LINK } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().post, INSTAGRAM_REEL);
  assert.equal(response.json().transcript, null);
  assert.equal(response.json().transcription.status, "needed");
  assert.deepEqual(asked, [{ platform: "instagram", url: `https://www.instagram.com/reel/${SHORTCODE}/`, withTranscript: true }]);
  await testApp.close();
});

test("a Facebook video with captions comes back with its words, as the account's own transcript, and nothing to offer", async () => {
  const { testApp } = await transcribingApp(captionedFacebookVideo());
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: READ_PATH, body: { url: FACEBOOK_LINK } });

  assert.deepEqual(response.json().post, FACEBOOK_VIDEO);
  assert.equal(response.json().transcript.videoId, `facebook:${FACEBOOK_VIDEO_ID}`);
  assert.equal(response.json().transcript.generated, true);
  assert.equal(response.json().transcript.segments.length, 2);
  assert.equal(response.json().transcription, undefined);
  await testApp.close();
});

test("a photo post is read for its description, and never offered to transcribe", async () => {
  const { testApp } = await transcribingApp(foundPost(INSTAGRAM_PHOTO_POST));
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: READ_PATH, body: { url: REEL_LINK } });

  assert.deepEqual(response.json(), { status: "read", post: INSTAGRAM_PHOTO_POST, transcript: null });
  await testApp.close();
});

test("a link that isn't a post, or can't be read, answers with why, not an error", async () => {
  const testApp = await appOver({ status: "failed", reason: "unavailable", credits: 0, vendorStatus: 404 });
  const account = await makeAccount(testApp);

  const profile = await account.inject({ method: "POST", url: READ_PATH, body: { url: "https://www.instagram.com/windowsillgarden/" } });
  const elsewhere = await account.inject({ method: "POST", url: READ_PATH, body: { url: "https://example.com/reel/1" } });
  const gone = await account.inject({ method: "POST", url: READ_PATH, body: { url: REEL_LINK } });

  assert.deepEqual(profile.json(), { status: "failed", reason: "not-a-post" });
  assert.deepEqual(elsewhere.json(), { status: "failed", reason: "not-a-post" });
  assert.deepEqual(gone.json(), { status: "failed", reason: "unavailable" });
  await testApp.close();
});

test("without the vendor's key, the read says Instagram and Facebook aren't read here", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const read = await account.inject({ method: "POST", url: READ_PATH, body: { url: REEL_LINK } });

  assert.equal(read.json().error.code, "unavailable");
  await testApp.close();
});

test("signed out, only a trial can ask our server to read a post, within the trial's reads", async () => {
  const testApp = await appOver();
  const device = await makeTrialDevice(testApp);

  const unknown = await testApp.app.inject({
    method: "POST",
    url: READ_PATH,
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { url: REEL_LINK },
  });
  const answered = [];
  for (let n = 0; n <= TRIAL_READS; n += 1) {
    answered.push(await device.readSocial(REEL_LINK));
  }

  assert.equal(unknown.statusCode, 401);
  assert.equal(answered[0]!.json().status, "read");
  assert.equal(answered.at(-1)!.statusCode, 429);
  await testApp.close();
});

test("each vendor credit lands in the cost tally, on the account or on no one yet", async () => {
  const testApp = await appOver();
  const account = await makeAccount(testApp);
  const device = await makeTrialDevice(testApp);

  await account.inject({ method: "POST", url: READ_PATH, body: { url: REEL_LINK } });
  await device.readSocial(FACEBOOK_LINK);

  assert.equal(await vendorCredits(testApp, "account_costs"), 1);
  assert.equal(await vendorCredits(testApp, "signed_out_costs"), 1);
  await testApp.close();
});

test("the log says the platform, the link's shape, the media and the cost, and never the link, the account or the words", async () => {
  const { logger, lines } = recordingLogger();
  const testApp = await appOver(captionedFacebookVideo(), logger);
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: READ_PATH, body: { url: FACEBOOK_LINK } });

  const [read] = saying(lines, "social post read");
  assert.equal(read?.platform, "facebook");
  assert.equal(read?.link, "post");
  assert.equal(read?.outcome, "read");
  assert.equal(read?.media, "video");
  assert.equal(read?.segments, 2);
  assert.equal(read?.credits, 1);
  const logged = JSON.stringify(lines);
  assert.ok(!logged.includes(FACEBOOK_VIDEO_ID) && !logged.includes("windowsill") && !logged.includes("Pinch the top"));
  await testApp.close();
});

test("asked to, our server reads the post afresh and transcribes its file, then hands back the words", async () => {
  const transcriber = makeScriptedTranscriber([{ state: "running" }, { state: "done", result: transcribedAudio({ audioSeconds: 58.8 }) }]);
  const { testApp, asked } = await transcribingApp(foundPost(), transcriber);
  const account = await makeAccount(testApp);

  const started = await account.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: REEL_LINK } });
  await testApp.drainTranscriptions();
  const ready = await account.inject({ method: "GET", url: `${TRANSCRIPTION_PATH}/${started.json().id}` });
  const again = await account.inject({ method: "POST", url: READ_PATH, body: { url: REEL_LINK } });

  assert.equal(started.statusCode, 200);
  assert.equal(started.json().status, "waiting");
  assert.equal(started.json().episodeSeconds, 59);
  assert.deepEqual(asked.at(0), { platform: "instagram", url: `https://www.instagram.com/reel/${SHORTCODE}/`, withTranscript: false });
  assert.equal(transcriber.submitted[0]?.audioUrl, INSTAGRAM_VIDEO_URL);
  assert.equal(ready.json().status, "ready");
  assert.equal(ready.json().transcript.videoId, `instagram:${SHORTCODE}`);
  assert.deepEqual(again.json().transcription, { status: "free", why: "transcribed" });
  assert.equal(await vendorCredits(testApp, "account_costs"), 2);
  await testApp.close();
});

test("a Facebook video with no captions transcribes from its smaller file", async () => {
  const transcriber = makeScriptedTranscriber();
  const { testApp } = await transcribingApp(foundPost(FACEBOOK_VIDEO), transcriber);
  const account = await makeAccount(testApp);

  const offered = await account.inject({ method: "POST", url: READ_PATH, body: { url: FACEBOOK_LINK } });
  await account.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: FACEBOOK_LINK } });
  await testApp.drainTranscriptions();

  assert.equal(offered.json().transcription.status, "needed");
  assert.equal(transcriber.submitted[0]?.audioUrl, FACEBOOK_SD_URL);
  await testApp.close();
});

test("transcribing a post needs an account, the host, a video that reads, and a video at all", async () => {
  const { testApp } = await transcribingApp();
  const withoutStt = await appOver();
  const elsewhere = await makeAccount(withoutStt);
  const gone = await transcribingApp({ status: "failed", reason: "unavailable", credits: 0, vendorStatus: 404 });
  const goneAccount = await makeAccount(gone.testApp);
  const photo = await transcribingApp(foundPost(INSTAGRAM_PHOTO_POST));
  const photoAccount = await makeAccount(photo.testApp);

  const signedOut = await testApp.app.inject({
    method: "POST",
    url: TRANSCRIPTION_PATH,
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { url: REEL_LINK },
  });
  const noHost = await elsewhere.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: REEL_LINK } });
  const unread = await goneAccount.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: REEL_LINK } });
  const noVideo = await photoAccount.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: REEL_LINK } });

  assert.equal(signedOut.json().error.code, "unauthenticated");
  assert.equal(noHost.json().error.code, "unavailable");
  assert.deepEqual([unread.json().error.code, unread.json().error.details], ["transcript_unavailable", { post: "unavailable" }]);
  assert.deepEqual(noVideo.json().error.details, { transcription: "no-audio" });
  await Promise.all([testApp.close(), withoutStt.close(), gone.testApp.close(), photo.testApp.close()]);
});

test("one account can't see another's post transcription", async () => {
  const { testApp } = await transcribingApp();
  const owner = await makeAccount(testApp);
  const other = await makeAccount(testApp);

  const started = await owner.inject({ method: "POST", url: TRANSCRIPTION_PATH, body: { url: REEL_LINK } });
  const peek = await other.inject({ method: "GET", url: `${TRANSCRIPTION_PATH}/${started.json().id}` });

  assert.equal(peek.json().error.code, "not_found");
  await testApp.close();
});
