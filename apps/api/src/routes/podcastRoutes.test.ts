import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, type PodcastEpisode, type PodcastRead } from "@overview/domain";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const LINK = "https://podcasts.apple.com/gb/podcast/a-show/id42?i=1001";
const EPISODE: PodcastEpisode = {
  feedUrl: "https://feeds.example/show.xml",
  guid: "older-guid",
  title: "Episode 1",
  showName: "A Show",
  publishedAt: "2026-11-01T09:00:00.000Z",
  durationSeconds: 3725,
  audioUrl: "https://media.example/ep1.mp3",
  pageUrl: null,
  imageUrl: null,
  notes: "",
  transcripts: [{ url: "https://show.example/ep1.vtt", type: "text/vtt", language: "en" }],
  chaptersUrl: null,
  linkFrom: "apple",
};

const appReading = (read: PodcastRead, logger?: ReturnType<typeof recordingLogger>["logger"]) =>
  createTestApp({}, { readPodcastEpisode: async () => read, ...(logger === undefined ? {} : { logger }) });

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("a podcast link comes back as its episode", async () => {
  const testApp = await appReading({ status: "read", episode: EPISODE });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/podcasts/read", body: { url: LINK } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "read", episode: EPISODE });
  await testApp.close();
});

test("an episode that can't be reached answers with why, not an error", async () => {
  const testApp = await appReading({ status: "failed", reason: "no-public-feed", showName: "A Show" });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/podcasts/read", body: { url: LINK } });

  assert.deepEqual(response.json(), { status: "failed", reason: "no-public-feed", showName: "A Show" });
  await testApp.close();
});

test("only an account can ask our server to read a podcast link", async () => {
  const testApp = await appReading({ status: "read", episode: EPISODE });

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/podcasts/read",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { url: LINK },
  });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("the log says where the link came from and how it went, and never the link", async () => {
  const { logger, lines } = recordingLogger();
  const testApp = await appReading({ status: "read", episode: EPISODE }, logger);
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: "/api/podcasts/read", body: { url: LINK } });

  const [line] = saying(lines, "podcast episode read");
  assert.equal(line?.linkFrom, "apple");
  assert.equal(line?.outcome, "read");
  assert.equal(line?.transcriptTags, 1);
  assert.ok(!JSON.stringify(lines).includes("id42"));
  await testApp.close();
});
