import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, type PodcastEpisode, type PodcastRead } from "@overview/domain";
import { Response } from "undici";
import { recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import type { PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
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
  notesKeywords: [],
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

const FEED_XML = `<?xml version="1.0"?><rss xmlns:podcast="https://podcastindex.org/namespace/1.0"><channel><title>A Show</title>
<item><title>Episode 1</title><guid>older-guid</guid><enclosure url="https://media.example/ep1.mp3" type="audio/mpeg"/>
<podcast:transcript url="https://show.example/ep1.vtt" type="text/vtt"/></item></channel></rss>`;
const VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello there.\n";

function scriptedWeb(pages: Record<string, { body: string; type: string }>) {
  const asked: string[] = [];
  const podcastWeb = async (link: string): Promise<PublicWebAnswer> => {
    asked.push(link);
    const page = pages[link];
    return page === undefined
      ? { status: "failed", reason: "missing" }
      : { status: "answered", url: link, response: new Response(page.body, { headers: { "content-type": page.type } }) };
  };
  return { podcastWeb, asked };
}

const appOverWeb = (web: ReturnType<typeof scriptedWeb>, logger?: ReturnType<typeof recordingLogger>["logger"]) =>
  createTestApp({}, { podcastWeb: web.podcastWeb, ...(logger === undefined ? {} : { logger }) });

test("an episode's transcript comes from its feed's tag once, and from the shared cache after", async () => {
  const web = scriptedWeb({
    [EPISODE.feedUrl]: { body: FEED_XML, type: "application/rss+xml" },
    "https://show.example/ep1.vtt": { body: VTT, type: "text/vtt" },
  });
  const testApp = await appOverWeb(web);
  const account = await makeAccount(testApp);
  const body = { feedUrl: EPISODE.feedUrl, guid: EPISODE.guid };

  const first = await account.inject({ method: "POST", url: "/api/podcasts/transcript", body });
  const second = await account.inject({ method: "POST", url: "/api/podcasts/transcript", body });

  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.json().segments, [{ text: "Hello there.", startMs: 1000, endMs: 3000 }]);
  assert.match(first.json().videoId, /^podcast:[0-9a-f]{32}$/);
  assert.deepEqual(second.json(), first.json());
  assert.equal(web.asked.length, 2);

  const shared = await testApp.app.inject({
    method: "GET",
    url: `/api/shared-transcripts/${encodeURIComponent(first.json().videoId)}`,
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });
  assert.equal(shared.statusCode, 200);
  await testApp.close();
});

test("an episode with no transcript tag says why, as the YouTube rungs do", async () => {
  const web = scriptedWeb({ [EPISODE.feedUrl]: { body: FEED_XML.replace(/<podcast:transcript[^>]*>/, ""), type: "application/rss+xml" } });
  const { logger, lines } = recordingLogger();
  const testApp = await appOverWeb(web, logger);
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/podcasts/transcript",
    body: { feedUrl: EPISODE.feedUrl, guid: EPISODE.guid },
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "transcript_unavailable");
  assert.equal(response.json().error.details.failure, "no-captions");
  assert.equal(saying(lines, "podcast transcript resolved")[0]?.failure, "no-captions");
  assert.ok(!JSON.stringify(lines).includes("feeds.example"));
  await testApp.close();
});

test("only an account can ask for a podcast transcript, and only for a feed address", async () => {
  const testApp = await appOverWeb(scriptedWeb({}));
  const signedOut = await testApp.app.inject({
    method: "POST",
    url: "/api/podcasts/transcript",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { feedUrl: EPISODE.feedUrl, guid: EPISODE.guid },
  });
  assert.equal(signedOut.statusCode, 401);
  const account = await makeAccount(testApp);
  const notAFeed = await account.inject({ method: "POST", url: "/api/podcasts/transcript", body: { feedUrl: "not a link", guid: "g" } });
  assert.equal(notAFeed.statusCode, 400);
  await testApp.close();
});
