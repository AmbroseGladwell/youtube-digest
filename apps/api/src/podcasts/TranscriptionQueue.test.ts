import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { PodcastTranscriptionsRepository } from "./PodcastTranscriptionsRepository.js";
import { makeScriptedTranscriber, transcribedAudio } from "./ScriptedTranscriber.testHelper.js";

const ASK = {
  id: "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a11",
  caller: "address:abc",
  accountId: null,
  sourceKey: "podcast:ep1",
  audioUrl: "https://media.example/ep1.mp3",
  maxSeconds: 15000,
  reserveSeconds: 1800,
  limitSeconds: 4 * 3600,
};

test("a job whose worker stopped after sending it is picked up where it was, and not sent twice", async () => {
  const transcriber = makeScriptedTranscriber([{ state: "done", result: transcribedAudio() }]);
  const testApp = await createTestApp({}, { transcriber });
  const jobs = new PodcastTranscriptionsRepository(testApp.sql);
  const now = testApp.clock.now;
  await jobs.request({ ...ASK, now });
  const claimed = await jobs.claimNext(now, new Date(now.getTime() + 60_000), now);
  await jobs.markSubmitted(claimed!.id, "fc-from-before", new Date(now.getTime() + 60_000));

  testApp.clock.advance(61_000);
  await testApp.drainTranscriptions();

  const job = await jobs.get(ASK.id, ASK.caller);
  assert.equal(job?.status, "ready");
  assert.equal(transcriber.submitted.length, 0);
  await testApp.close();
});

test("a host that stops answering fails the job rather than holding the reader forever", async () => {
  const transcriber = makeScriptedTranscriber([new Error("connection refused")]);
  const testApp = await createTestApp({}, { transcriber });
  const jobs = new PodcastTranscriptionsRepository(testApp.sql);
  await jobs.request({ ...ASK, now: testApp.clock.now });

  await testApp.drainTranscriptions();

  const job = await jobs.get(ASK.id, ASK.caller);
  assert.equal(job?.status, "failed");
  assert.equal(job?.failure, "failed");
  assert.deepEqual(transcriber.cancelled, ["fc-1"]);
  assert.equal(await jobs.usedSeconds(testApp.clock.now, ASK.caller), 0);
  await testApp.close();
});

test("words a reader never collected are gone a day after they were made", async () => {
  const testApp = await createTestApp({}, { transcriber: makeScriptedTranscriber() });
  const jobs = new PodcastTranscriptionsRepository(testApp.sql);
  await jobs.request({ ...ASK, now: testApp.clock.now });
  await testApp.drainTranscriptions();
  assert.equal((await jobs.get(ASK.id, ASK.caller))?.status, "ready");

  testApp.clock.advance(24 * 60 * 60 * 1000 + 1000);
  await testApp.drainTranscriptions();

  assert.equal(await jobs.get(ASK.id, ASK.caller), null);
  await testApp.close();
});
