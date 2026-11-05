import test from "node:test";
import assert from "node:assert/strict";
import { ClientErrorBatch } from "./ClientErrorBatch.js";
import { ClientTiming, readClientTiming, type SentClientTiming } from "./ClientTiming.js";

const AT = "2026-11-05T09:00:00.000Z";
const context = { surface: "extension", layout: "panel", appVersion: "0.4.1", platform: "macos" } as const;
const timed: ClientTiming = {
  name: "captureTimed",
  outcome: "finished",
  steps: [
    { step: "stored", outcome: "no-answer", ms: 4 },
    { step: "shared-cache", outcome: "no-answer", ms: 310 },
    { step: "service", outcome: "answered", ms: 2_900 },
    { step: "model", outcome: "answered", ms: 41_000 },
    { step: "save", outcome: "answered", ms: 12 },
  ],
  totalMs: 44_300,
  transcriptCharacters: 18_400,
  at: AT,
};

test("a batch can carry timings alone, beside errors and warnings", () => {
  assert.ok(ClientErrorBatch.safeParse({ context, errors: [], timings: [timed] }).success);
  assert.ok(!ClientErrorBatch.safeParse({ context, errors: [], timings: [] }).success);
});

test("a timing carries enums and counts only, never a video, a title or a word of the transcript", () => {
  assert.ok(!ClientTiming.safeParse({ ...timed, videoId: "dQw4w9WgXcQ" }).success);
  assert.ok(!ClientTiming.safeParse({ ...timed, outcome: "it went fine" }).success);
  assert.ok(!ClientTiming.safeParse({ ...timed, totalMs: -1 }).success);
  assert.ok(!ClientTiming.safeParse({ ...timed, totalMs: 12.5 }).success);
  assert.ok(!ClientTiming.safeParse({ ...timed, steps: Array(7).fill(timed.steps[0]) }).success);
});

test("a step the API doesn't know, or an outcome it doesn't, is dropped rather than logged", () => {
  const sent: SentClientTiming = {
    ...timed,
    steps: [
      { step: "https://youtu.be/dQw4w9WgXcQ", outcome: "answered", ms: 5 },
      { step: "model", outcome: "took ages", ms: 5 },
      { step: "model", outcome: "answered", ms: 41_000 },
    ],
  };

  assert.deepEqual(readClientTiming(sent).steps, [{ step: "model", outcome: "answered", ms: 41_000 }]);
});
