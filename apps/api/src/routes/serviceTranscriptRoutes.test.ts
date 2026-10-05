import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { FIXTURE_VIDEO_ID } from "@overview/transcripts/testing";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeFakeYouTube, type FakeYouTube } from "../transcripts/FakeYouTube.testHelper.js";
import { serviceTranscriptQuotas } from "../transcripts/ServiceTranscripts.js";
import { ServiceUsageRepository, usageDay } from "../transcripts/ServiceUsageRepository.js";

const HEADERS = { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) };
const videoIdNumbered = (n: number) => `vid${String(n).padStart(8, "0")}`;

async function serviceApp(youTube: FakeYouTube, proxyDailyFetches = 1000): Promise<TestApp> {
  return createTestApp({}, { transcriptService: { fetches: youTube.fetches, proxyDailyFetches } });
}

const askAnonymously = (testApp: TestApp, videoId: string, remoteAddress = "203.0.113.7") =>
  testApp.app.inject({ method: "POST", url: `/api/service-transcripts/${videoId}`, headers: HEADERS, remoteAddress });

test("a signed-out reader gets a transcript our server fetched, and the next reader gets it from the shared cache", async () => {
  const youTube = makeFakeYouTube();
  const testApp = await serviceApp(youTube);

  const fetched = await askAnonymously(testApp, FIXTURE_VIDEO_ID);
  const shared = await testApp.app.inject({ method: "GET", url: `/api/shared-transcripts/${FIXTURE_VIDEO_ID}` });

  assert.equal(fetched.statusCode, 200);
  assert.equal(fetched.json().videoId, FIXTURE_VIDEO_ID);
  assert.equal(fetched.json().video.url, `https://www.youtube.com/watch?v=${FIXTURE_VIDEO_ID}`);
  assert.equal(shared.statusCode, 200);
  assert.deepEqual(shared.json().segments, fetched.json().segments);
  assert.equal(youTube.requests.filter((request) => request.route === "proxy").length, 0);
  await testApp.close();
});

test("a video already in the shared cache is answered without contacting YouTube or counting against the reader", async () => {
  const youTube = makeFakeYouTube();
  const testApp = await serviceApp(youTube);
  await askAnonymously(testApp, FIXTURE_VIDEO_ID, "198.51.100.1");
  const before = youTube.requests.length;

  const answers = [];
  for (let ask = 0; ask < serviceTranscriptQuotas.address + 1; ask += 1) {
    answers.push((await askAnonymously(testApp, FIXTURE_VIDEO_ID)).statusCode);
  }

  assert.deepEqual(new Set(answers), new Set([200]));
  assert.equal(youTube.requests.length, before);
  await testApp.close();
});

test("when YouTube turns our own address away, the transcript is fetched through the proxy on one session", async () => {
  const youTube = makeFakeYouTube({ direct: "bot-check", proxy: "captions" });
  const testApp = await serviceApp(youTube);

  const response = await askAnonymously(testApp, FIXTURE_VIDEO_ID);
  const proxied = youTube.requests.filter((request) => request.route === "proxy");
  const spend = await new ServiceUsageRepository(testApp.sql).spendOn(usageDay(testApp.clock.now));

  assert.equal(response.statusCode, 200);
  assert.ok(proxied.length >= 2);
  assert.deepEqual(new Set(proxied.map((request) => request.session)), new Set(["session-1"]));
  assert.equal(youTube.sessionsClosed, 1);
  assert.equal(spend.proxied, 1);
  assert.ok(spend.proxyBytes > 0);
  await testApp.close();
});

test("a bot check through the proxy is tried once more on a fresh session, then reported", async () => {
  const youTube = makeFakeYouTube({ direct: "bot-check", proxy: "bot-check" });
  const testApp = await serviceApp(youTube);

  const response = await askAnonymously(testApp, FIXTURE_VIDEO_ID);
  const sessions = new Set(youTube.requests.filter((request) => request.route === "proxy").map((request) => request.session));

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "transcript_unavailable");
  assert.equal(response.json().error.details.failure, "access-restricted");
  assert.deepEqual(sessions, new Set(["session-1", "session-2"]));
  await testApp.close();
});

test("once the day's proxy budget is spent, the reader is told so and the proxy is not used", async () => {
  const youTube = makeFakeYouTube({ direct: "bot-check", proxy: "captions" });
  const testApp = await serviceApp(youTube, 1);
  await askAnonymously(testApp, videoIdNumbered(1));

  const response = await askAnonymously(testApp, videoIdNumbered(2));

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.details.failure, "budget-exhausted");
  assert.equal(youTube.requests.filter((request) => request.route === "proxy" && request.videoId === videoIdNumbered(2)).length, 0);
  await testApp.close();
});

test("the budget is a day's: the next UTC day the proxy is used again", async () => {
  const youTube = makeFakeYouTube({ direct: "bot-check", proxy: "captions" });
  const testApp = await serviceApp(youTube, 1);
  await askAnonymously(testApp, videoIdNumbered(1));
  testApp.clock.advance(24 * 60 * 60 * 1000);

  const response = await askAnonymously(testApp, videoIdNumbered(2));

  assert.equal(response.statusCode, 200);
  await testApp.close();
});

test("a fetch our own address answers costs no proxy budget", async () => {
  const youTube = makeFakeYouTube();
  const testApp = await serviceApp(youTube, 1);
  await askAnonymously(testApp, videoIdNumbered(1));
  youTube.answers.direct = "bot-check";

  const response = await askAnonymously(testApp, videoIdNumbered(2));

  assert.equal(response.statusCode, 200);
  await testApp.close();
});

test("a video with no captions is never tried through the proxy, and is not asked about again for a while", async () => {
  const youTube = makeFakeYouTube({ direct: "no-captions", proxy: "captions" });
  const testApp = await serviceApp(youTube);

  const first = await askAnonymously(testApp, FIXTURE_VIDEO_ID);
  const asked = youTube.requests.length;
  const second = await askAnonymously(testApp, FIXTURE_VIDEO_ID, "198.51.100.2");

  assert.equal(first.json().error.details.failure, "no-captions");
  assert.equal(second.json().error.details.failure, "no-captions");
  assert.equal(youTube.requests.filter((request) => request.route === "proxy").length, 0);
  assert.equal(youTube.requests.length, asked);
  await testApp.close();
});

test("a signed-out address has a small daily quota, and is told when it can ask again", async () => {
  const youTube = makeFakeYouTube();
  const testApp = await serviceApp(youTube);
  for (let n = 1; n <= serviceTranscriptQuotas.address; n += 1) {
    assert.equal((await askAnonymously(testApp, videoIdNumbered(n))).statusCode, 200);
  }

  const refused = await askAnonymously(testApp, videoIdNumbered(99));

  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().error.details.daily, true);
  assert.equal(refused.headers["retry-after"], String(15 * 60 * 60));
  await testApp.close();
});

test("a signed-in reader is counted by account at its plan's quota, not by address", async () => {
  const youTube = makeFakeYouTube();
  const testApp = await serviceApp(youTube);
  const account = await makeAccount(testApp);
  for (let n = 1; n <= serviceTranscriptQuotas.address; n += 1) {
    await askAnonymously(testApp, videoIdNumbered(n), "127.0.0.1");
  }

  const answers = [];
  for (let n = 1; n <= serviceTranscriptQuotas.free + 1; n += 1) {
    answers.push((await account.inject({ method: "POST", url: `/api/service-transcripts/${videoIdNumbered(100 + n)}` })).statusCode);
  }

  assert.deepEqual(answers.slice(0, serviceTranscriptQuotas.free), Array(serviceTranscriptQuotas.free).fill(200));
  assert.equal(answers.at(-1), 429);
  await testApp.close();
});

test("readers asking for one video at the same moment share one fetch", async () => {
  const youTube = makeFakeYouTube();
  const testApp = await serviceApp(youTube);

  const answers = await Promise.all([
    askAnonymously(testApp, FIXTURE_VIDEO_ID, "198.51.100.3"),
    askAnonymously(testApp, FIXTURE_VIDEO_ID, "198.51.100.4"),
  ]);

  assert.deepEqual(answers.map((answer) => answer.statusCode), [200, 200]);
  assert.equal(youTube.requests.filter((request) => request.url.includes("timedtext")).length, 1);
  await testApp.close();
});

test("a server with the service off says so, and refuses to fetch", async () => {
  const testApp = await createTestApp();

  const status = await testApp.app.inject({ method: "GET", url: "/api/service-transcripts" });
  const refused = await askAnonymously(testApp, FIXTURE_VIDEO_ID);

  assert.deepEqual(status.json(), { available: false });
  assert.equal(refused.statusCode, 503);
  await testApp.close();
});

test("a server with the service on says so", async () => {
  const testApp = await serviceApp(makeFakeYouTube());

  const status = await testApp.app.inject({ method: "GET", url: "/api/service-transcripts" });

  assert.deepEqual(status.json(), { available: true });
  await testApp.close();
});
