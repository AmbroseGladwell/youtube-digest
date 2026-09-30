import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, MAX_SPOKEN_SCRIPT_CHARACTERS } from "@overview/domain";
import { AudioRendersRepository } from "../audio/AudioRendersRepository.js";
import { MAX_RENDER_ATTEMPTS } from "../audio/AudioRenderQueue.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { MAX_OUTSTANDING_RENDERS_PER_ACCOUNT } from "./audioRoutes.js";

const LINES = ["Verdict", "Recycled.", "Standard advice."];
const MINUTE_MS = 60 * 1000;

const ask = (account: TestAccount, body: Record<string, unknown>) =>
  account.inject({ method: "POST", url: "/api/audio", body });

const poll = (account: TestAccount, key: string) => account.inject({ method: "GET", url: `/api/audio/${key}` });

const fileOf = (testApp: TestApp, key: string, headers: Record<string, string> = {}) =>
  testApp.app.inject({ method: "GET", url: `/api/audio/${key}/file`, headers });

test("asking for narration queues it, and polling says so until it is rendered", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const asked = await ask(account, { lines: LINES });
  const polled = await poll(account, asked.json().key);

  assert.equal(asked.statusCode, 202);
  assert.equal(asked.json().status, "queued");
  assert.deepEqual(polled.json(), { key: asked.json().key, status: "queued" });
  await testApp.close();
});

test("rendered narration is polled as ready, with a start for every line and a file to play", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const { key } = (await ask(account, { lines: LINES })).json();

  await testApp.drainAudio();
  const polled = await poll(account, key);
  const file = await fileOf(testApp, key);

  assert.deepEqual(polled.json(), {
    key,
    status: "ready",
    lineStartsSeconds: [0, 1, 2],
    durationSeconds: 3,
    fileUrl: `/api/audio/${key}/file`,
  });
  assert.equal(file.statusCode, 200);
  assert.equal(file.headers["content-type"], "audio/mp4");
  assert.equal(file.headers["accept-ranges"], "bytes");
  assert.equal(file.body, "narration of Verdict | Recycled. | Standard advice. in af_heart");
  await testApp.close();
});

test("asking again for narration already rendered answers at once and renders nothing", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await ask(account, { lines: LINES });
  await testApp.drainAudio();

  const again = await ask(account, { lines: LINES });

  assert.equal(again.statusCode, 200);
  assert.equal(again.json().status, "ready");
  assert.equal(testApp.narrator.requests.length, 1);
  await testApp.close();
});

test("two accounts asking for the same words in the same voice share one render", async () => {
  const testApp = await createTestApp();
  const first = await makeAccount(testApp);
  const second = await makeAccount(testApp);

  const a = await ask(first, { lines: LINES });
  const b = await ask(second, { lines: LINES });
  await testApp.drainAudio();

  assert.equal(a.json().key, b.json().key);
  assert.equal(testApp.narrator.requests.length, 1);
  await testApp.close();
});

test("the same words in another voice are another render, spoken in that voice's language", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const american = await ask(account, { lines: LINES });
  const british = await ask(account, { lines: LINES, voice: "bm_george" });
  await testApp.drainAudio();

  assert.notEqual(american.json().key, british.json().key);
  assert.deepEqual(
    testApp.narrator.requests.map(({ voice, language }) => [voice, language]),
    [
      ["af_heart", "en-us"],
      ["bm_george", "en-gb"],
    ],
  );
  await testApp.close();
});

test("someone pressing play goes ahead of every note rendering in the background", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const other = await makeAccount(testApp);
  await ask(account, { lines: ["First background note."], priority: "background" });
  testApp.clock.advance(1000);
  await ask(account, { lines: ["Second background note."], priority: "background" });
  testApp.clock.advance(1000);
  await ask(other, { lines: ["Pressed play."] });

  await testApp.drainAudio();

  assert.deepEqual(
    testApp.narrator.requests.map(({ lines }) => lines[0]),
    ["Pressed play.", "First background note.", "Second background note."],
  );
  await testApp.close();
});

test("pressing play on a note waiting in the background makes it urgent", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await ask(account, { lines: ["Older background note."], priority: "background" });
  testApp.clock.advance(1000);
  await ask(account, { lines: ["Newer background note."], priority: "background" });
  await ask(account, { lines: ["Newer background note."], priority: "interactive" });

  await testApp.drainAudio();

  assert.equal(testApp.narrator.requests[0]!.lines[0], "Newer background note.");
  await testApp.close();
});

test("a render that fails is tried again after a wait, not straight away", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const { key } = (await ask(account, { lines: LINES })).json();
  testApp.narrator.failNext("TTS answered 503");

  await testApp.drainAudio();
  const afterFailure = await poll(account, key);
  testApp.clock.advance(MINUTE_MS);
  await testApp.drainAudio();
  const afterRetry = await poll(account, key);

  assert.equal(afterFailure.json().status, "queued");
  assert.equal(afterRetry.json().status, "ready");
  assert.equal(testApp.narrator.requests.length, 2);
  await testApp.close();
});

test("a render that fails every attempt is failed, and asking again starts it over", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const { key } = (await ask(account, { lines: LINES })).json();
  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt += 1) {
    testApp.narrator.failNext("TTS answered 503");
    await testApp.drainAudio();
    testApp.clock.advance(5 * MINUTE_MS);
  }

  const failed = await poll(account, key);
  const askedAgain = await ask(account, { lines: LINES });
  await testApp.drainAudio();

  assert.equal(failed.json().status, "failed");
  assert.equal(askedAgain.json().status, "queued");
  assert.equal((await poll(account, key)).json().status, "ready");
  await testApp.close();
});

test("a render whose worker stopped without finishing is taken up again", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const { key } = (await ask(account, { lines: LINES })).json();
  const renders = new AudioRendersRepository(testApp.sql);
  await renders.claimNext(testApp.clock.now, new Date(0), MAX_RENDER_ATTEMPTS);

  await testApp.drainAudio();
  const whileHeld = await poll(account, key);
  testApp.clock.advance(20 * MINUTE_MS);
  await testApp.drainAudio();

  assert.equal(whileHeld.json().status, "rendering");
  assert.equal((await poll(account, key)).json().status, "ready");
  await testApp.close();
});

test("an account with its limit of narration waiting is refused more, but not what is already waiting", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  for (let note = 0; note < MAX_OUTSTANDING_RENDERS_PER_ACCOUNT; note += 1) {
    await ask(account, { lines: [`Note ${note}.`] });
  }

  const oneMore = await ask(account, { lines: ["One note too many."] });
  const repeated = await ask(account, { lines: ["Note 0."] });

  assert.equal(oneMore.statusCode, 429);
  assert.equal(oneMore.json().error.code, "too_many_requests");
  assert.equal(repeated.statusCode, 202);
  await testApp.close();
});

test("a voice it does not offer, an empty script or one over the cap is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const responses = await Promise.all([
    ask(account, { lines: LINES, voice: "ff_siwis" }),
    ask(account, { lines: [] }),
    ask(account, { lines: ["a".repeat(MAX_SPOKEN_SCRIPT_CHARACTERS + 1)] }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.json().error.code),
    ["invalid_request", "invalid_request", "invalid_request"],
  );
  assert.equal(testApp.narrator.requests.length, 0);
  await testApp.close();
});

test("a server with no TTS service says narration is unavailable", async () => {
  const testApp = await createTestApp({}, { narration: false });
  const account = await makeAccount(testApp);

  const response = await ask(account, { lines: LINES });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "unavailable");
  await testApp.close();
});

test("polling needs a session, but the file plays in an <audio> element that sends none", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const { key } = (await ask(account, { lines: LINES })).json();
  await testApp.drainAudio();

  const polled = await testApp.app.inject({
    method: "GET",
    url: `/api/audio/${key}`,
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });
  const file = await fileOf(testApp, key);

  assert.equal(polled.statusCode, 401);
  assert.equal(file.statusCode, 200);
  await testApp.close();
});

test("the file answers a byte range with just those bytes, and an impossible one with 416", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const { key } = (await ask(account, { lines: LINES })).json();
  await testApp.drainAudio();
  const size = testApp.audioStore.files.get(key)!.length;

  const firstBytes = await fileOf(testApp, key, { range: "bytes=0-8" });
  const pastTheEnd = await fileOf(testApp, key, { range: `bytes=${size}-` });

  assert.equal(firstBytes.statusCode, 206);
  assert.equal(firstBytes.headers["content-range"], `bytes 0-8/${size}`);
  assert.equal(firstBytes.body, "narration");
  assert.equal(pastTheEnd.statusCode, 416);
  assert.equal(pastTheEnd.headers["content-range"], `bytes */${size}`);
  await testApp.close();
});

test("a key nobody asked for is not found, and one that is not a key is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const unknown = await poll(account, "0".repeat(64));
  const malformed = await fileOf(testApp, "not-a-key");

  assert.equal(unknown.json().error.code, "not_found");
  assert.equal(malformed.json().error.code, "invalid_request");
  await testApp.close();
});
