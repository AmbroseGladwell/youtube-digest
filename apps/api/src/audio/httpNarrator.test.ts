import test from "node:test";
import assert from "node:assert/strict";
import { REQUEST_ID_HEADER } from "@overview/domain";
import { createHttpNarrator } from "./httpNarrator.js";
import type { LineNarrated, NarrationRequest } from "./Narrator.js";

const REQUEST: NarrationRequest = {
  lines: ["Verdict", "Recycled."],
  voice: "bf_emma",
  language: "en-gb",
  renderVersion: 1,
};

const base64 = (text: string) => Buffer.from(text).toString("base64");

const segment = (index: number) => ({ index, durationSeconds: 1.024, audioBase64: base64(`segment ${index}`) });

const lineEvent = (index: number, startSeconds: number, segments = [segment(index)]) => ({ type: "line", index, startSeconds, segments });

const doneEvent = (overrides: Record<string, unknown> = {}) => ({
  type: "done",
  renderVersion: 1,
  lineStartsSeconds: [0, 1.2],
  durationSeconds: 3.4,
  synthesisSeconds: 1.1,
  audioBase64: base64("m4a bytes"),
  segments: [segment(2)],
  ...overrides,
});

const streaming = (events: unknown[], chunkSize = 7) => {
  const calls: { url: string; body: unknown; requestId: string | undefined }[] = [];
  const text = events.map((event) => `${JSON.stringify(event)}\n`).join("");
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), requestId: (init.headers as Record<string, string>)[REQUEST_ID_HEADER] });
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let at = 0; at < bytes.length; at += chunkSize) {
          controller.enqueue(bytes.subarray(at, at + chunkSize));
        }
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
};

const refusing = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

const collect = () => {
  const lines: LineNarrated[] = [];
  return { lines, onLine: async (line: LineNarrated) => void lines.push(line) };
};

test("posts the script to the service's /render/stream and hands over each line as it arrives", async () => {
  const { calls, fetchImpl } = streaming([lineEvent(0, 0), lineEvent(1, 1.2), doneEvent()]);
  const { lines, onLine } = collect();

  await createHttpNarrator("http://tts.internal:8000/", fetchImpl).narrate(REQUEST, "tts-request-0001", onLine);

  assert.deepEqual(calls, [{ url: "http://tts.internal:8000/render/stream", body: REQUEST, requestId: "tts-request-0001" }]);
  assert.deepEqual(lines, [
    { lineIndex: 0, startSeconds: 0, segments: [{ index: 0, durationSeconds: 1.024, audio: Buffer.from("segment 0") }] },
    { lineIndex: 1, startSeconds: 1.2, segments: [{ index: 1, durationSeconds: 1.024, audio: Buffer.from("segment 1") }] },
  ]);
});

test("hands back the decoded audio, the timings and the segments after the last line", async () => {
  const { fetchImpl } = streaming([lineEvent(0, 0), lineEvent(1, 1.2), doneEvent()]);

  const narration = await createHttpNarrator("http://tts", fetchImpl).narrate(REQUEST, "tts-request-0001", collect().onLine);

  assert.deepEqual(narration, {
    lineStartsSeconds: [0, 1.2],
    durationSeconds: 3.4,
    synthesisSeconds: 1.1,
    audio: Buffer.from("m4a bytes"),
    trailingSegments: [{ index: 2, durationSeconds: 1.024, audio: Buffer.from("segment 2") }],
  });
});

test("a line shown but not spoken arrives with no segments", async () => {
  const { fetchImpl } = streaming([lineEvent(0, 0), lineEvent(1, 1.2, []), doneEvent()]);
  const { lines, onLine } = collect();

  await createHttpNarrator("http://tts", fetchImpl).narrate(REQUEST, "tts-request-0001", onLine);

  assert.deepEqual(lines[1]!.segments, []);
});

test("a refusal carries the service's own error code", async () => {
  await assert.rejects(
    createHttpNarrator("http://tts", refusing(409, { error: { code: "render_version_mismatch", message: "renders version 2" } })).narrate(
      REQUEST,
      "tts-request-0001",
      collect().onLine,
    ),
    /render_version_mismatch/,
  );
});

test("a render that fails partway is refused with the service's code, after the lines that did arrive", async () => {
  const { fetchImpl } = streaming([lineEvent(0, 0), { type: "error", error: { code: "internal_error", message: "Something went wrong" } }]);
  const { lines, onLine } = collect();

  await assert.rejects(createHttpNarrator("http://tts", fetchImpl).narrate(REQUEST, "tts-request-0001", onLine), /internal_error/);
  assert.equal(lines.length, 1);
});

test("a stream that stops before it finishes is refused", async () => {
  const { fetchImpl } = streaming([lineEvent(0, 0)]);

  await assert.rejects(
    createHttpNarrator("http://tts", fetchImpl).narrate(REQUEST, "tts-request-0001", collect().onLine),
    /stopped before/,
  );
});

test("audio rendered at another version, or timed for the wrong number of lines, is refused", async () => {
  await assert.rejects(
    createHttpNarrator("http://tts", streaming([doneEvent({ renderVersion: 2 })]).fetchImpl).narrate(
      REQUEST,
      "tts-request-0001",
      collect().onLine,
    ),
    /version 2/,
  );
  await assert.rejects(
    createHttpNarrator("http://tts", streaming([doneEvent({ lineStartsSeconds: [0] })]).fetchImpl).narrate(
      REQUEST,
      "tts-request-0001",
      collect().onLine,
    ),
    /1 lines of 2/,
  );
});
