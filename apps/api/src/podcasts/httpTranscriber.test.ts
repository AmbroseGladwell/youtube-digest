import test from "node:test";
import assert from "node:assert/strict";
import { createHttpTranscriber } from "./httpTranscriber.js";
import { transcribedAudio } from "./ScriptedTranscriber.testHelper.js";

const recordingFetch = (answers: { status?: number; body: unknown }[]) => {
  const calls: { url: string; method: string; authorization: string | null; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    calls.push({
      url,
      method: init.method ?? "GET",
      authorization: headers.get("authorization"),
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const answer = answers.shift()!;
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, calls };
};

test("a job is sent with the token, asked after by its call, and cancelled", async () => {
  const { fetchImpl, calls } = recordingFetch([
    { body: { callId: "fc-1" } },
    { body: { state: "done", result: transcribedAudio() } },
    { body: {} },
  ]);
  const transcriber = createHttpTranscriber("https://stt.example/", "t".repeat(64), fetchImpl);

  assert.equal(await transcriber.submit("https://media.example/ep1.mp3", 15000), "fc-1");
  assert.deepEqual(await transcriber.status("fc-1"), { state: "done", result: transcribedAudio() });
  await transcriber.cancel("fc-1");

  assert.deepEqual(
    calls.map(({ url, method }) => `${method} ${url}`),
    ["POST https://stt.example/jobs", "GET https://stt.example/jobs/fc-1", "DELETE https://stt.example/jobs/fc-1"],
  );
  assert.ok(calls.every((call) => call.authorization === `Bearer ${"t".repeat(64)}`));
  assert.deepEqual(calls[0]!.body, { audioUrl: "https://media.example/ep1.mp3", maxSeconds: 15000 });
});

test("an answer that isn't a job's state is refused rather than trusted", async () => {
  const { fetchImpl } = recordingFetch([{ body: { state: "done", result: { segments: [] } } }, { status: 401, body: {} }]);
  const transcriber = createHttpTranscriber("https://stt.example", "t".repeat(64), fetchImpl);

  await assert.rejects(transcriber.status("fc-1"));
  await assert.rejects(transcriber.status("fc-1"), /answered 401/);
});
