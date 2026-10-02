import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION_HEADER, type StoredTranscript } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { LOG_LEVELS, recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

const SPOKEN = "Words only the video said";

const spoken = () => makeStoredTranscript({ segments: [{ text: SPOKEN, startMs: 0, endMs: 1000 }] });

const noteOn = (account: TestAccount, transcript: StoredTranscript) =>
  account.inject({ method: "POST", url: "/api/overviews", body: storedOverview({ video: transcript.video! }) });

const upload = (account: TestAccount, transcript: StoredTranscript) =>
  account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

const readShared = (testApp: TestApp, videoId: string) =>
  testApp.app.inject({ method: "GET", url: `/api/shared-transcripts/${videoId}`, headers: { [CLIENT_VERSION_HEADER]: "1" } });

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

const assertNoVideoOrWords = (lines: LogLine[], transcript: StoredTranscript) => {
  const logged = JSON.stringify(lines.filter(({ msg }) => msg !== "incoming request" && msg !== "request completed"));
  assert.doesNotMatch(logged, new RegExp(SPOKEN));
  assert.doesNotMatch(logged, new RegExp(transcript.videoId));
};

test("an upload is logged at info with how it counted towards the shared copy, and never with its words or video", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const [first, second] = [await makeAccount(testApp), await makeAccount(testApp)];
  const transcript = spoken();

  for (const account of [first, second]) {
    await noteOn(account, transcript);
    await upload(account, transcript);
  }

  const stored = saying(lines, "transcript stored");
  assert.deepEqual(
    stored.map(({ level, contribution, segments, accountId }) => ({ level, contribution, segments, accountId })),
    [
      { level: LOG_LEVELS.info, contribution: "pending", segments: 1, accountId: first.accountId },
      { level: LOG_LEVELS.info, contribution: "confirmed", segments: 1, accountId: second.accountId },
    ],
  );
  assertNoVideoOrWords(lines, transcript);
  await testApp.close();
});

test("an upload with no live note is logged at warn as not kept", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);

  await upload(account, spoken());

  const [notKept] = saying(lines, "transcript not kept");
  assert.deepEqual({ level: notKept!.level, contribution: notKept!.contribution }, { level: LOG_LEVELS.warn, contribution: "not-noted" });
  assert.equal(saying(lines, "transcript stored").length, 0);
  await testApp.close();
});

test("a faulted upload is logged at warn with its fault", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const empty = makeStoredTranscript({ segments: [] });
  await noteOn(account, empty);

  await upload(account, empty);

  const [refused] = saying(lines, "transcript refused");
  assert.deepEqual({ level: refused!.level, fault: refused!.fault, segments: refused!.segments }, { level: LOG_LEVELS.warn, fault: "no-segments", segments: 0 });
  await testApp.close();
});

test("an account's own copy read back, and the shared cache's hits and misses, are logged at info", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const transcript = spoken();
  await noteOn(account, transcript);
  await upload(account, transcript);

  await account.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` });
  await readShared(testApp, transcript.videoId);

  assert.equal(saying(lines, "transcript served")[0]!.level, LOG_LEVELS.info);
  const [read] = saying(lines, "shared transcript read");
  assert.deepEqual({ level: read!.level, hit: read!.hit }, { level: LOG_LEVELS.info, hit: false });
  assertNoVideoOrWords(lines, transcript);
  await testApp.close();
});

test("deleting the last note on a video logs how many transcripts the account stopped keeping", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const transcript = spoken();
  const note = storedOverview({ video: transcript.video! });
  await account.inject({ method: "POST", url: "/api/overviews", body: note });
  await upload(account, transcript);

  await account.inject({ method: "DELETE", url: `/api/overviews/${note.id}` });

  const [forgotten] = saying(lines, "transcripts forgotten");
  assert.deepEqual({ level: forgotten!.level, count: forgotten!.count }, { level: LOG_LEVELS.info, count: 1 });
  await testApp.close();
});
