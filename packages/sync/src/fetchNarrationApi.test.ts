import test from "node:test";
import assert from "node:assert/strict";
import { narrationKey } from "@overview/domain";
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
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

test("peeking asks for the key the server would compute, and queues nothing", async () => {
  const key = await narrationKey(LINES, "af_heart");
  const { sent, fetch } = answering(200, { key, status: "queued" });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example/", token: "t", fetch });

  assert.deepEqual(await api.peek(LINES, "af_heart"), { key, status: "queued" });
  assert.deepEqual(sent, [{ url: `https://overview.example/api/audio/${key}`, method: "GET", body: undefined }]);
});

test("a peek at narration nobody has asked for is null, not a failure", async () => {
  const { fetch } = answering(404, { error: { code: "not_found", message: "No narration" } });
  const api = createFetchNarrationApi({ baseUrl: "https://overview.example", fetch });

  assert.equal(await api.peek(LINES, "af_heart"), null);
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

  assert.equal(
    api.fileUrl({ key, status: "ready", lineStartsSeconds: [0, 1], durationSeconds: 3, fileUrl: `/api/audio/${key}/file` }),
    `https://overview.example/api/audio/${key}/file`,
  );
});
