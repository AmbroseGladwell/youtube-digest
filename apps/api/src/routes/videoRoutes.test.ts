import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_READS, VideoId, type VideoSource } from "@overview/domain";
import { FIXTURE_VIDEO_ID } from "@overview/transcripts/testing";
import { makeFakeOpenAi, type FakeOpenAi } from "../generation/FakeOpenAi.testHelper.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import { makeFakeYouTube, type FakeYouTube, type YouTubeAnswer } from "../transcripts/FakeYouTube.testHelper.js";
import { SIGNED_OUT_KIND_CHECKS_DAILY } from "../videos/VideoKindsRepository.js";
import type { VideoReader } from "../videos/youTubeDataApiVideoReader.js";

const VIDEO: VideoSource = {
  id: VideoId.parse(FIXTURE_VIDEO_ID),
  url: `https://www.youtube.com/watch?v=${FIXTURE_VIDEO_ID}`,
  title: "Knife Skills in Ten Minutes",
  channel: "Kitchen Basics",
  description: null,
  durationMs: 725_000,
  publishedAt: null,
  thumbnailUrl: null,
};
const reading: VideoReader = async () => VIDEO;

const appReading = async ({
  reader = reading,
  captions = "captions",
  logger,
  openAi = makeFakeOpenAi(),
}: {
  reader?: VideoReader | null;
  captions?: YouTubeAnswer;
  logger?: ReturnType<typeof recordingLogger>["logger"];
  openAi?: FakeOpenAi;
} = {}) => {
  const youTube: FakeYouTube = makeFakeYouTube({ direct: captions, proxy: captions });
  const testApp = await createTestApp(
    {},
    {
      ...(reader === null ? {} : { videoReader: reader }),
      transcriptService: { fetches: youTube.fetches, proxyDailyFetches: 1000 },
      ourKey: { apiKey: "sk-test-ours", dailyGenerations: 300, signedOutDailyGenerations: 50, dailyChatMessages: 20_000, http: openAi.http },
      ...(logger === undefined ? {} : { logger }),
    },
  );
  return { testApp, youTube, openAi };
};

const playerFetches = (youTube: FakeYouTube) => youTube.requests.filter((request) => request.videoId === FIXTURE_VIDEO_ID).length;

test("an account reads a video's card, its kind and the transcript the kind was checked from", async () => {
  const { testApp, openAi } = await appReading();
  openAi.kindCheckAnswer = "recipe";
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/videos/read", body: { videoId: FIXTURE_VIDEO_ID } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "read");
  assert.equal(response.json().video.title, "Knife Skills in Ten Minutes");
  assert.equal(response.json().noteKind, "recipe");
  assert.equal(response.json().transcript.videoId, FIXTURE_VIDEO_ID);
  assert.ok(response.json().transcript.segments.length > 0);
  assert.equal(openAi.kindChecks, 1);
  await testApp.close();
});

test("a video already checked for anyone isn't checked or fetched again", async () => {
  const { testApp, youTube, openAi } = await appReading();
  openAi.kindCheckAnswer = "recipe";
  await (await makeAccount(testApp)).inject({ method: "POST", url: "/api/videos/read", body: { videoId: FIXTURE_VIDEO_ID } });
  const fetchedBefore = playerFetches(youTube);

  const device = await makeTrialDevice(testApp);
  const response = await device.readVideo(FIXTURE_VIDEO_ID);

  assert.equal(response.json().noteKind, "recipe");
  assert.equal(response.json().transcript, null);
  assert.equal(openAi.kindChecks, 1);
  assert.equal(playerFetches(youTube), fetchedBefore);
  await testApp.close();
});

test("a video with no captions reads with no kind, so it goes the video's way", async () => {
  const { testApp, openAi } = await appReading({ captions: "no-captions" });
  const device = await makeTrialDevice(testApp);

  const response = await device.readVideo(FIXTURE_VIDEO_ID);

  assert.equal(response.json().status, "read");
  assert.equal(response.json().noteKind, null);
  assert.equal(openAi.kindChecks, 0);
  await testApp.close();
});

test("a kind check that fails still hands back the transcript, so it isn't fetched twice", async () => {
  const { testApp, openAi } = await appReading();
  openAi.kindCheckAnswer = { status: 503, body: { error: { message: "overloaded" } } };
  const device = await makeTrialDevice(testApp);

  const response = await device.readVideo(FIXTURE_VIDEO_ID);

  assert.equal(response.json().noteKind, null);
  assert.equal(response.json().transcript.videoId, FIXTURE_VIDEO_ID);
  await testApp.close();
});

test("signed out, the day's kind checks are capped across every device, and reads carry on without one", async () => {
  const { lines, logger } = recordingLogger();
  const { testApp, openAi } = await appReading({ logger });
  await testApp.sql.query("insert into video_kind_checks_signed_out (day, checks) values ($1::date, $2)", [
    testApp.clock.now.toISOString().slice(0, 10),
    SIGNED_OUT_KIND_CHECKS_DAILY,
  ]);
  const device = await makeTrialDevice(testApp);

  const response = await device.readVideo(FIXTURE_VIDEO_ID);

  assert.equal(response.json().status, "read");
  assert.equal(response.json().noteKind, null);
  assert.equal(openAi.kindChecks, 0);
  assert.equal(lines.filter((line) => line.msg === "signed-out kind checks spent").length, 1);
  await testApp.close();
});

test("signed out, a video is read on the trial's reads, and the video id is never logged", async () => {
  const { lines, logger } = recordingLogger();
  const { testApp } = await appReading({ logger });
  const device = await makeTrialDevice(testApp);

  const read = [];
  for (let n = 0; n < TRIAL_READS; n += 1) read.push((await device.readVideo(FIXTURE_VIDEO_ID)).statusCode);
  const next = await device.readVideo(FIXTURE_VIDEO_ID);

  assert.deepEqual(
    read,
    Array.from({ length: TRIAL_READS }, () => 200),
  );
  assert.equal(next.statusCode, 429);
  assert.equal(next.json().error.details.quota, "trial-reads");
  assert.ok(!JSON.stringify(lines).includes(FIXTURE_VIDEO_ID));
  await testApp.close();
});

test("with neither an account nor a trial, nothing is read", async () => {
  const { testApp } = await appReading();

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/videos/read",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { videoId: FIXTURE_VIDEO_ID },
  });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("a server with no YouTube key says it can't read videos", async () => {
  const { testApp } = await appReading({ reader: null });
  const device = await makeTrialDevice(testApp);

  const response = await device.readVideo(FIXTURE_VIDEO_ID);

  assert.equal(response.statusCode, 503);
  await testApp.close();
});

test("YouTube not listing the video answers not found, and failing answers unavailable", async () => {
  const { testApp: missing } = await appReading({ reader: async () => null });
  const { testApp: failing } = await appReading({
    reader: async () => {
      throw new Error("The YouTube Data API answered 500 to videos");
    },
  });

  const notFound = await (await makeAccount(missing)).inject({ method: "POST", url: "/api/videos/read", body: { videoId: FIXTURE_VIDEO_ID } });
  const unavailable = await (await makeAccount(failing)).inject({
    method: "POST",
    url: "/api/videos/read",
    body: { videoId: FIXTURE_VIDEO_ID },
  });

  assert.deepEqual(notFound.json(), { status: "failed", reason: "not-found" });
  assert.deepEqual(unavailable.json(), { status: "failed", reason: "unavailable" });
  await missing.close();
  await failing.close();
});
