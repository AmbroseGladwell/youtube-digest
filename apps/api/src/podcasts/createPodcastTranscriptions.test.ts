import test from "node:test";
import assert from "node:assert/strict";
import { Response } from "undici";
import { podcastSourceId } from "@overview/domain";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import type { PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeTrialDevice } from "../testing/TrialDevice.testHelper.js";
import { makeFakeOpenAi } from "../generation/FakeOpenAi.testHelper.js";
import { makeScriptedTranscriber, transcribedAudio, type ScriptedTranscriber } from "./ScriptedTranscriber.testHelper.js";
import { START_WAIT_MS } from "./TranscriptionQueue.js";

const FEED_URL = "https://feeds.example/show.xml";
const item = (guid: string, seconds: number | null) => `<item><title>Episode ${guid}</title><guid>${guid}</guid>
${seconds === null ? "" : `<itunes:duration>${seconds}</itunes:duration>`}
<enclosure url="https://media.example/${guid}.mp3" type="audio/mpeg"/></item>`;
const feed = (...items: string[]) =>
  `<?xml version="1.0"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>A Show</title>${items.join("")}</channel></rss>`;
const EPISODE = { feedUrl: FEED_URL, guid: "ep1" };

const webOf =
  (body: string) =>
  async (link: string): Promise<PublicWebAnswer> =>
    link === FEED_URL
      ? { status: "answered", url: link, response: new Response(body, { headers: { "content-type": "application/rss+xml" } }) }
      : { status: "failed", reason: "missing" };

const appWith = (transcriber: ScriptedTranscriber, body = feed(item("ep1", 1800)), logger?: ReturnType<typeof recordingLogger>["logger"]) =>
  createTestApp({}, { podcastWeb: webOf(body), transcriber, ...(logger === undefined ? {} : { logger }) });

const usedSeconds = async (testApp: Awaited<ReturnType<typeof createTestApp>>) =>
  (await testApp.sql.query<{ seconds: number }>("select seconds from transcription_usage")).reduce((sum, row) => sum + row.seconds, 0);

test("a reader asks for an episode to be transcribed, waits, and collects its words", async () => {
  const transcriber = makeScriptedTranscriber();
  const testApp = await appWith(transcriber);
  const account = await makeAccount(testApp);

  const asked = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  assert.equal(asked.statusCode, 200);
  assert.equal(asked.json().status, "waiting");
  assert.equal(asked.json().episodeSeconds, 1800);

  await testApp.drainTranscriptions();
  const collected = await account.inject({ method: "GET", url: `/api/podcasts/transcription/${asked.json().id}` });

  assert.equal(collected.json().status, "ready");
  assert.equal(collected.json().transcript.videoId, `podcast:${await podcastSourceId(EPISODE)}`);
  assert.equal(collected.json().transcript.generated, true);
  assert.deepEqual(collected.json().transcript.segments, transcribedAudio().segments);
  assert.deepEqual(transcriber.submitted, [{ audioUrl: "https://media.example/ep1.mp3", maxSeconds: 4 * 3600 + 600 }]);
  assert.equal(await usedSeconds(testApp), 1791);
  const [cost] = await testApp.sql.query<{ area: string; detail: string; quantity: number }>(
    "select area, detail, quantity::float8 as quantity from account_costs",
  );
  assert.deepEqual(cost, { area: "transcripts", detail: "speech-to-text", quantity: 1791 });
  await testApp.close();
});

test("asking again for an episode already transcribed, or on its way, starts nothing and costs nothing more", async () => {
  const transcriber = makeScriptedTranscriber();
  const testApp = await appWith(transcriber);
  const account = await makeAccount(testApp);

  const first = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  const whileWaiting = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  await testApp.drainTranscriptions();
  const afterwards = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });

  assert.equal(whileWaiting.json().id, first.json().id);
  assert.equal(afterwards.json().status, "ready");
  assert.equal(transcriber.submitted.length, 1);
  assert.equal(await usedSeconds(testApp), 1791);
  await testApp.close();
});

test("with no card started within the wait, the attempt fails, is cancelled, and costs the reader nothing", async () => {
  const transcriber = makeScriptedTranscriber([{ state: "waiting" }]);
  const testApp = await appWith(transcriber);
  const account = await makeAccount(testApp);
  const startedAt = testApp.clock.now.getTime();

  const asked = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  await testApp.drainTranscriptions();
  const collected = await account.inject({ method: "GET", url: `/api/podcasts/transcription/${asked.json().id}` });

  assert.deepEqual(collected.json(), { status: "failed", id: asked.json().id, reason: "no-transcriber" });
  assert.deepEqual(transcriber.cancelled, ["fc-1"]);
  assert.ok(testApp.clock.now.getTime() - startedAt > START_WAIT_MS);
  assert.equal(await usedSeconds(testApp), 0);
  await testApp.close();
});

test("a worker that started is waited for past the start limit, and a failed attempt can be asked again", async () => {
  const transcriber = makeScriptedTranscriber([
    ...Array.from({ length: 80 }, () => ({ state: "running" as const })),
    { state: "failed", error: "audio_unreachable" },
  ]);
  const testApp = await appWith(transcriber);
  const account = await makeAccount(testApp);

  const asked = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  await testApp.drainTranscriptions();
  const failed = await account.inject({ method: "GET", url: `/api/podcasts/transcription/${asked.json().id}` });
  assert.equal(failed.json().reason, "audio-unreachable");
  assert.equal(await usedSeconds(testApp), 0);

  transcriber.script = [{ state: "done", result: transcribedAudio() }];
  const again = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  await testApp.drainTranscriptions();
  const collected = await account.inject({ method: "GET", url: `/api/podcasts/transcription/${again.json().id}` });

  assert.equal(collected.json().status, "ready");
  assert.equal(transcriber.submitted.length, 2);
  await testApp.close();
});

test("an episode longer than four hours by its feed is refused before anything is sent", async () => {
  const transcriber = makeScriptedTranscriber();
  const testApp = await appWith(transcriber, feed(item("ep1", 5 * 3600)));
  const account = await makeAccount(testApp);

  const asked = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });

  assert.equal(asked.statusCode, 422);
  assert.equal(asked.json().error.details.transcription, "too-long");
  assert.equal(transcriber.submitted.length, 0);
  await testApp.close();
});

test("a free account transcribes up to five hours a month, and is told when they are spent", async () => {
  const transcriber = makeScriptedTranscriber([{ state: "done", result: transcribedAudio({ audioSeconds: 3 * 3600 }) }]);
  const testApp = await appWith(transcriber, feed(item("ep1", 3 * 3600), item("ep2", 3 * 3600)));
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  await testApp.drainTranscriptions();
  const second = await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: { ...EPISODE, guid: "ep2" } });

  assert.equal(second.statusCode, 429);
  assert.equal(second.json().error.details.quota, "transcription");
  assert.equal(second.json().error.details.limitSeconds, 5 * 3600);
  assert.equal(second.json().error.details.usedSeconds, 3 * 3600);
  assert.ok(Number(second.headers["retry-after"]) > 0);
  assert.equal(transcriber.submitted.length, 1);
  await testApp.close();
});

test("signed out, a trial can transcribe an episode, and no one else can read what it asked for", async () => {
  const testApp = await createTestApp(
    {},
    {
      podcastWeb: webOf(feed(item("ep1", 1800))),
      transcriber: makeScriptedTranscriber(),
      ourKey: { apiKey: "sk-test-ours", dailyGenerations: 300, signedOutDailyGenerations: 50, http: makeFakeOpenAi().http },
    },
  );
  const device = await makeTrialDevice(testApp);
  const account = await makeAccount(testApp);

  const asked = await device.transcribe(EPISODE);
  await testApp.drainTranscriptions();

  assert.equal((await device.transcription(asked.json().id)).json().status, "ready");
  assert.equal((await account.inject({ method: "GET", url: `/api/podcasts/transcription/${asked.json().id}` })).statusCode, 404);
  await testApp.close();
});

test("an episode with no transcript says it can be transcribed only where a transcriber is set up", async () => {
  const noTag = feed(item("ep1", 1800));
  const withTranscriber = await appWith(makeScriptedTranscriber(), noTag);
  const without = await createTestApp({}, { podcastWeb: webOf(noTag) });

  const offered = await (await makeAccount(withTranscriber)).inject({ method: "POST", url: "/api/podcasts/transcript", body: EPISODE });
  const accountWithout = await makeAccount(without);
  const notOffered = await accountWithout.inject({ method: "POST", url: "/api/podcasts/transcript", body: EPISODE });
  const refused = await accountWithout.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });

  assert.equal(offered.json().error.details.transcribable, true);
  assert.equal(notOffered.json().error.details.transcribable, undefined);
  assert.equal(refused.statusCode, 503);
  await withTranscriber.close();
  await without.close();
});

test("the log says how long the reader waited and what it cost, and never the feed, the episode or its audio", async () => {
  const { logger, lines } = recordingLogger();
  const testApp = await appWith(makeScriptedTranscriber(), feed(item("ep1", 1800)), logger);
  const account = await makeAccount(testApp);

  await account.inject({ method: "POST", url: "/api/podcasts/transcription", body: EPISODE });
  await testApp.drainTranscriptions();

  const finished = lines.find((line) => line.msg === "episode transcribed");
  assert.equal(finished?.gpu, "Tesla T4");
  assert.equal(finished?.dollars, (30 / 3600) * 0.59);
  assert.equal(typeof lines.find((line) => line.msg === "episode transcription started")?.waitedSeconds, "number");
  const logged = JSON.stringify(lines);
  for (const secret of ["feeds.example", "media.example", "Welcome back"]) assert.ok(!logged.includes(secret), secret);
  await testApp.close();
});
