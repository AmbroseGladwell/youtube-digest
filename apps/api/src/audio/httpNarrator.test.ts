import test from "node:test";
import assert from "node:assert/strict";
import { createHttpNarrator } from "./httpNarrator.js";
import type { NarrationRequest } from "./Narrator.js";

const REQUEST: NarrationRequest = {
  lines: ["Verdict", "Recycled."],
  voice: "bf_emma",
  language: "en-gb",
  renderVersion: 1,
};

const answering = (status: number, body: unknown) => {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
};

const rendered = (overrides: Record<string, unknown> = {}) => ({
  renderVersion: 1,
  lineStartsSeconds: [0, 1.2],
  durationSeconds: 3.4,
  synthesisSeconds: 1.1,
  audioBase64: Buffer.from("m4a bytes").toString("base64"),
  ...overrides,
});

test("posts the script to the service's /render and hands back the decoded audio and timings", async () => {
  const { calls, fetchImpl } = answering(200, rendered());

  const narration = await createHttpNarrator("http://tts.internal:8000/", fetchImpl).narrate(REQUEST);

  assert.deepEqual(calls, [{ url: "http://tts.internal:8000/render", body: REQUEST }]);
  assert.deepEqual(narration, {
    lineStartsSeconds: [0, 1.2],
    durationSeconds: 3.4,
    synthesisSeconds: 1.1,
    audio: Buffer.from("m4a bytes"),
  });
});

test("a refusal carries the service's own error code", async () => {
  const { fetchImpl } = answering(409, { error: { code: "render_version_mismatch", message: "renders version 2" } });

  await assert.rejects(createHttpNarrator("http://tts", fetchImpl).narrate(REQUEST), /render_version_mismatch/);
});

test("audio rendered at another version, or timed for the wrong number of lines, is refused", async () => {
  await assert.rejects(
    createHttpNarrator("http://tts", answering(200, rendered({ renderVersion: 2 })).fetchImpl).narrate(REQUEST),
    /version 2/,
  );
  await assert.rejects(
    createHttpNarrator("http://tts", answering(200, rendered({ lineStartsSeconds: [0] })).fetchImpl).narrate(REQUEST),
    /1 lines of 2/,
  );
});
