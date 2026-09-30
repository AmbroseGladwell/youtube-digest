import test from "node:test";
import assert from "node:assert/strict";
import { createR2AudioStore } from "./r2AudioStore.js";

const KEY = "a".repeat(64);
const SETTINGS = {
  accountId: "0123456789abcdef0123456789abcdef",
  bucket: "the-overview-audio-test",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret",
};

const answering = (status: number, body: BodyInit | null = null) => {
  const requests: Request[] = [];
  const fetchImpl = (async (request: Request) => {
    requests.push(request);
    return new Response(body, { status });
  }) as typeof fetch;
  return { requests, fetchImpl };
};

test("puts the audio as a signed PUT of an .m4a object in the bucket", async () => {
  const { requests, fetchImpl } = answering(200);

  await createR2AudioStore(SETTINGS, fetchImpl).put(KEY, Buffer.from("narration"));

  const [request] = requests;
  assert.equal(request!.method, "PUT");
  assert.equal(request!.url, `https://${SETTINGS.accountId}.r2.cloudflarestorage.com/${SETTINGS.bucket}/${KEY}.m4a`);
  assert.equal(request!.headers.get("content-type"), "audio/mp4");
  assert.match(request!.headers.get("authorization")!, /^AWS4-HMAC-SHA256 Credential=test-access-key\//);
  assert.equal(await request!.text(), "narration");
});

test("reads back what the bucket holds, and nothing for a key it does not", async () => {
  const found = await createR2AudioStore(SETTINGS, answering(200, "narration").fetchImpl).get(KEY);
  const missing = await createR2AudioStore(SETTINGS, answering(404).fetchImpl).get(KEY);

  assert.deepEqual(found, Buffer.from("narration"));
  assert.equal(missing, null);
});

test("any other refusal is an error, not an empty answer", async () => {
  await assert.rejects(createR2AudioStore(SETTINGS, answering(403).fetchImpl).get(KEY), /403/);
  await assert.rejects(createR2AudioStore(SETTINGS, answering(500).fetchImpl).put(KEY, Buffer.from("x")), /500/);
});

test("deletes the object with a signed DELETE, and a key already gone is not an error", async () => {
  const { requests, fetchImpl } = answering(204);

  await createR2AudioStore(SETTINGS, fetchImpl).delete(KEY);
  await createR2AudioStore(SETTINGS, answering(404).fetchImpl).delete(KEY);

  assert.equal(requests[0]!.method, "DELETE");
  assert.equal(requests[0]!.url, `https://${SETTINGS.accountId}.r2.cloudflarestorage.com/${SETTINGS.bucket}/${KEY}.m4a`);
  await assert.rejects(createR2AudioStore(SETTINGS, answering(403).fetchImpl).delete(KEY), /403/);
});
