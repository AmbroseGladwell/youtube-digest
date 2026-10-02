import test from "node:test";
import assert from "node:assert/strict";
import { LOG_LEVELS, recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { MAX_RENDER_ATTEMPTS } from "./AudioRenderQueue.js";

const SPOKEN = "A line only this note says";
const LINES = ["Verdict", SPOKEN];
const MINUTE_MS = 60 * 1000;

const ask = (account: TestAccount) => account.inject({ method: "POST", url: "/api/audio", body: { lines: LINES } });

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("narration asked for is logged as queued, then rendered with its size and how long it took from the request", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const { key } = (await ask(account)).json();
  testApp.clock.advance(MINUTE_MS);

  await testApp.drainAudio();

  const [queued] = saying(lines, "audio queued");
  assert.deepEqual(
    { level: queued!.level, key: queued!.key, lines: queued!.lines, status: queued!.status, accountId: queued!.accountId },
    { level: LOG_LEVELS.info, key, lines: 2, status: "queued", accountId: account.accountId },
  );
  const [rendered] = saying(lines, "audio rendered");
  assert.equal(rendered!.level, LOG_LEVELS.info);
  assert.equal(rendered!.key, key);
  assert.equal(rendered!.lines, 2);
  assert.equal(rendered!.requestToReadySeconds, 60);
  assert.ok((rendered!.bytes as number) > 0);
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(SPOKEN));
  await testApp.close();
});

test("a render that will be tried again is a warn, and one that gave up is an error, neither quoting the script", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  await ask(account);

  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt += 1) {
    testApp.narrator.failNext(`TTS refused the render: internal_error: could not say '${SPOKEN}'`);
    await testApp.drainAudio();
    testApp.clock.advance(5 * MINUTE_MS);
  }

  assert.deepEqual(
    saying(lines, "audio render failed").map(({ level, attempt, status }) => ({ level, attempt, status })),
    [
      { level: LOG_LEVELS.warn, attempt: 1, status: "queued" },
      { level: LOG_LEVELS.warn, attempt: 2, status: "queued" },
    ],
  );
  const [gaveUp] = saying(lines, "audio render gave up");
  assert.deepEqual({ level: gaveUp!.level, attempt: gaveUp!.attempt, status: gaveUp!.status }, { level: LOG_LEVELS.error, attempt: 3, status: "failed" });
  assert.match(gaveUp!.error as string, /TTS refused the render/);
  assert.doesNotMatch(JSON.stringify(lines), new RegExp(SPOKEN));
  await testApp.close();
});
