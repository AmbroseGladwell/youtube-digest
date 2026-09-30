import test from "node:test";
import assert from "node:assert/strict";
import { NarrationVoice } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { audioKey } from "./audioKey.js";
import { MAX_RENDER_ATTEMPTS } from "./AudioRenderQueue.js";
import { AudioRendersRepository } from "./AudioRendersRepository.js";
import { SUPERSEDED_SAMPLE_KEPT_MS } from "./seedVoiceSamples.js";
import { VOICE_SAMPLE_LINES } from "./voiceSampleLines.js";
import { VoiceSamplesRepository } from "./VoiceSamplesRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const OLD_LINES = ["Hey there!", "An older sample."];

test("the first seed queues the same passage in every offered voice, in that voice", async () => {
  const testApp = await createTestApp();

  const seeded = await testApp.seedVoiceSamples();
  await testApp.drainAudio();

  assert.deepEqual([...seeded.queued].sort(), [...NarrationVoice.options].sort());
  assert.equal(testApp.narrator.requests.length, NarrationVoice.options.length);
  assert.ok(testApp.narrator.requests.every((request) => request.lines.join() === VOICE_SAMPLE_LINES.join()));
  assert.deepEqual(testApp.narrator.requests.map((request) => request.voice).sort(), [...NarrationVoice.options].sort());
  await testApp.close();
});

test("seeding again once the samples are rendered queues nothing and renders nothing", async () => {
  const testApp = await createTestApp();
  await testApp.seedVoiceSamples();
  await testApp.drainAudio();

  const again = await testApp.seedVoiceSamples();
  await testApp.drainAudio();

  assert.deepEqual(again.queued, []);
  assert.equal(testApp.narrator.requests.length, NarrationVoice.options.length);
  await testApp.close();
});

test("samples that failed every attempt are queued again by the next seed", async () => {
  const testApp = await createTestApp();
  await testApp.seedVoiceSamples();
  for (let failure = 0; failure < NarrationVoice.options.length * MAX_RENDER_ATTEMPTS; failure += 1) {
    testApp.narrator.failNext("the TTS service is down");
  }
  for (let attempt = 0; attempt < MAX_RENDER_ATTEMPTS; attempt += 1) {
    await testApp.drainAudio();
    testApp.clock.advance(DAY_MS);
  }

  const again = await testApp.seedVoiceSamples();
  await testApp.drainAudio();

  assert.equal(again.queued.length, NarrationVoice.options.length);
  assert.equal(testApp.audioStore.files.size, NarrationVoice.options.length);
  await testApp.close();
});

test("a sample the passage has moved past is kept for 30 days, then deleted with its file", async () => {
  const testApp = await createTestApp();
  const renders = new AudioRendersRepository(testApp.sql);
  const oldKey = audioKey(OLD_LINES, "af_heart");
  await renders.enqueue({
    key: oldKey,
    voice: "af_heart",
    renderVersion: 1,
    lines: OLD_LINES,
    priority: "background",
    requestedBy: null,
    now: testApp.clock.now,
  });
  await new VoiceSamplesRepository(testApp.sql).markCurrent([{ key: oldKey, voice: "af_heart" }], testApp.clock.now);
  await testApp.drainAudio();

  await testApp.seedVoiceSamples();
  testApp.clock.advance(SUPERSEDED_SAMPLE_KEPT_MS - DAY_MS);
  const withinThirtyDays = await testApp.seedVoiceSamples();
  const stillThere = testApp.audioStore.files.has(oldKey);
  testApp.clock.advance(2 * DAY_MS);
  const afterThirtyDays = await testApp.seedVoiceSamples();

  assert.deepEqual(withinThirtyDays.deleted, []);
  assert.equal(stillThere, true);
  assert.deepEqual(afterThirtyDays.deleted, [oldKey]);
  assert.equal(testApp.audioStore.files.has(oldKey), false);
  assert.equal(await renders.get(oldKey), null);
  await testApp.close();
});

test("a superseded sample that becomes current again is no longer on its way out", async () => {
  const testApp = await createTestApp();
  const samples = new VoiceSamplesRepository(testApp.sql);
  await testApp.seedVoiceSamples();
  await samples.markCurrent([], testApp.clock.now);

  await testApp.seedVoiceSamples();
  testApp.clock.advance(SUPERSEDED_SAMPLE_KEPT_MS + DAY_MS);
  const later = await testApp.seedVoiceSamples();

  assert.deepEqual(later.deleted, []);
  assert.deepEqual(await samples.supersededBefore(testApp.clock.now), []);
  await testApp.close();
});
