import test from "node:test";
import assert from "node:assert/strict";
import { NarrationVoice, narrationKey } from "@overview/domain";
import { createFetchNarrationApi } from "./fetchNarrationApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const LINES = ["Premise", "A talking-head explainer."];

const answering = (status: number, body: unknown) => {
  const sent: Array<{ url: string; method: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body === undefined ? undefined : JSON.parse(init.body as string),
    });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const ready = (key: string) => ({
  key,
  status: "ready",
  lineStartsSeconds: [0, 1],
  durationSeconds: 3,
  fileUrl: `/api/audio/${key}/file`,
});

test("peeking looks the note up in every offered voice at once, and queues nothing", async () => {
  const { sent, fetch } = answering(200, { renders: [] });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example/", token: "t", fetch });

  assert.equal(await api.peek(LINES, "af_heart"), null);
  const keys = await Promise.all(NarrationVoice.options.map((voice) => narrationKey(LINES, voice)));
  assert.deepEqual(sent, [{ url: "https://overview.example/api/audio/lookup", method: "POST", body: { keys } }]);
});

test("a peek answers the chosen voice's narration in whatever state it is in, ahead of any other", async () => {
  const heart = await narrationKey(LINES, "af_heart");
  const george = await narrationKey(LINES, "bm_george");
  const { fetch } = answering(200, { renders: [ready(heart), { key: george, status: "queued" }] });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.peek(LINES, "bm_george"), { voice: "bm_george", render: { key: george, status: "queued" } });
});

test("with nothing in the chosen voice, a peek answers narration ready in another voice", async () => {
  const heart = await narrationKey(LINES, "af_heart");
  const emma = await narrationKey(LINES, "bf_emma");
  const { fetch } = answering(200, { renders: [{ key: emma, status: "failed" }, ready(heart)] });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.peek(LINES, "bm_george"), { voice: "af_heart", render: ready(heart) });
});

test("discarding narration deletes it by key, and narration already gone is not a failure", async () => {
  const key = await narrationKey(LINES, "af_heart");
  const deleted = answering(204, null);
  const gone = answering(404, { error: { code: "not_found", message: "No narration" } });

  await createFetchNarrationApi({ baseUrl: "https://overview.example", fetch: deleted.fetch }).discard(key);
  await createFetchNarrationApi({ baseUrl: "https://overview.example", fetch: gone.fetch }).discard(key);

  assert.deepEqual(deleted.sent, [{ url: `https://overview.example/api/audio/${key}`, method: "DELETE", body: undefined }]);
});

test("the samples list skips a voice this client does not offer rather than losing every sample", async () => {
  const { fetch } = answering(200, {
    samples: [
      { voice: "af_heart", fileUrl: "/api/audio/a/file", durationSeconds: 17.7 },
      { voice: "af_sky", fileUrl: "/api/audio/b/file", durationSeconds: 16 },
    ],
  });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.samples(), [{ voice: "af_heart", fileUrl: "/api/audio/a/file", durationSeconds: 17.7 }]);
});

test("asking for narration posts the script, the voice and the priority", async () => {
  const key = await narrationKey(LINES, "af_heart");
  const { sent, fetch } = answering(202, { key, status: "queued" });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example", fetch });

  await api.request(LINES, "af_heart", "interactive");

  assert.deepEqual(sent, [
    {
      url: "https://overview.example/api/audio",
      method: "POST",
      body: { lines: LINES, voice: "af_heart", priority: "interactive" },
    },
  ]);
});

test("an account with too much waiting is refused with the server's own code", async () => {
  const { fetch } = answering(429, { error: { code: "too_many_requests", message: "Too much" } });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.request(LINES, "af_heart", "interactive"), (error: unknown) => {
    assert.ok(isSyncRequestError(error));
    assert.equal(error.code, "too_many_requests");
    return true;
  });
});

test("the file is played from the API's own origin, since an <audio> element sends no bearer", async () => {
  const key = await narrationKey(LINES, "af_heart");
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example/", fetch: answering(200, {}).fetch });

  assert.equal(api.fileUrl(ready(key)), `https://overview.example/api/audio/${key}/file`);
});
