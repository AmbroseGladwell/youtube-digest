import test from "node:test";
import assert from "node:assert/strict";
import { Response } from "undici";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, TRIAL_READS } from "@overview/domain";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import type { PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import { createTikTokReader } from "../tiktok/createTikTokReader.js";
import {
  CAPTIONS_URL,
  CAPTIONS_VTT,
  makeTikTokItem,
  makeTikTokPage,
  pageWithItem,
  VIDEO_ID,
} from "../tiktok/TikTokPageFactory.testHelper.js";

const LINK = `https://www.tiktok.com/@anewsroom/video/${VIDEO_ID}?is_from_webapp=1`;
const PAGE = `https://www.tiktok.com/@/video/${VIDEO_ID}`;

const appOver = (web: Record<string, string>, logger?: ReturnType<typeof recordingLogger>["logger"]) => {
  const fetchPublicWeb = async (link: string): Promise<PublicWebAnswer> =>
    web[link] === undefined
      ? { status: "failed", reason: "missing" }
      : { status: "answered", url: link, response: new Response(web[link]) };
  return createTestApp({}, { tiktokReader: createTikTokReader({ fetchPublicWeb }), ...(logger === undefined ? {} : { logger }) });
};

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("a TikTok link comes back as its video", async () => {
  const testApp = await appOver({ [PAGE]: makeTikTokPage() });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "read");
  assert.equal(response.json().video.url, `https://www.tiktok.com/@anewsroom/video/${VIDEO_ID}`);
  assert.deepEqual(response.json().video.captions, [{ language: "eng-US", source: "ASR" }]);
  await testApp.close();
});

test("a link that can't be read answers with why, not an error", async () => {
  const testApp = await appOver({});
  const account = await makeAccount(testApp);

  const notAVideo = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: "https://www.tiktok.com/@anewsroom" } });
  const gone = await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });

  assert.deepEqual(notAVideo.json(), { status: "failed", reason: "not-a-video" });
  assert.deepEqual(gone.json(), { status: "failed", reason: "unavailable" });
  await testApp.close();
});

test("signed out, only a trial can ask our server to read a TikTok link, within the trial's reads", async () => {
  const testApp = await appOver({ [PAGE]: makeTikTokPage() });
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

test("an account gets the video's words as its own transcript", async () => {
  const testApp = await appOver({ [PAGE]: makeTikTokPage(), [CAPTIONS_URL]: CAPTIONS_VTT });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { videoId: VIDEO_ID } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().videoId, `tiktok:${VIDEO_ID}`);
  assert.equal(response.json().generated, true);
  assert.ok(response.json().segments.length > 0);
  await testApp.close();
});

test("signed out, a trial can't fetch a TikTok's words", async () => {
  const testApp = await appOver({ [PAGE]: makeTikTokPage(), [CAPTIONS_URL]: CAPTIONS_VTT });
  const device = await makeTrialDevice(testApp);

  const response = await device.tiktokTranscript(VIDEO_ID);

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("a video with no captions answers transcript_unavailable with the failure named", async () => {
  const testApp = await appOver({ [PAGE]: pageWithItem(makeTikTokItem({}, { subtitleInfos: [] })) });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { videoId: VIDEO_ID } });

  assert.equal(response.json().error.code, "transcript_unavailable");
  assert.equal(response.json().error.details.failure, "no-captions");
  await testApp.close();
});

test("a video id that isn't TikTok's shape is refused before any fetch", async () => {
  const testApp = await appOver({});
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { videoId: "../../etc" } });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("the log says the link's shape and how it went, and never the link, the handle or the video", async () => {
  const { logger, lines } = recordingLogger();
  const testApp = await appOver({ [PAGE]: makeTikTokPage(), [CAPTIONS_URL]: CAPTIONS_VTT }, logger);
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: "/api/tiktok/read", body: { url: LINK } });
  await account.inject({ method: "POST", url: "/api/tiktok/transcript", body: { videoId: VIDEO_ID } });

  const [read] = saying(lines, "tiktok video read");
  const [transcript] = saying(lines, "tiktok transcript resolved");
  assert.equal(read?.link, "video");
  assert.equal(read?.outcome, "read");
  assert.equal(read?.captions, 1);
  assert.equal(transcript?.source, "ASR");
  assert.equal(transcript?.segments, 3);
  const logged = JSON.stringify(lines);
  assert.ok(!logged.includes(VIDEO_ID) && !logged.includes("anewsroom"));
  await testApp.close();
});
