import test from "node:test";
import assert from "node:assert/strict";
import { r2SpendStore } from "./r2SpendStore.mjs";

function fakeR2(answers) {
  const requests = [];
  const fetch = async (request) => {
    requests.push({
      url: request.url,
      method: request.method,
      authorization: request.headers.get("authorization"),
      body: await request.text(),
    });
    return answers.shift();
  };
  return { fetch, requests };
}

const settings = { accountId: "acct", bucket: "the-overview-spend", accessKeyId: "id", secretAccessKey: "secret" };

test("a day's CSV is put at its key in the bucket, signed", async () => {
  const r2 = fakeR2([new Response(null, { status: 200 })]);
  await r2SpendStore({ ...settings, fetch: r2.fetch }).put("daily/2026-11-08.csv", "date\n");
  assert.equal(r2.requests[0].url, "https://acct.r2.cloudflarestorage.com/the-overview-spend/daily/2026-11-08.csv");
  assert.equal(r2.requests[0].method, "PUT");
  assert.equal(r2.requests[0].body, "date\n");
  assert.match(r2.requests[0].authorization, /^AWS4-HMAC-SHA256 Credential=id\//);
});

test("a bucket in a jurisdiction is reached at that jurisdiction's address", async () => {
  const r2 = fakeR2([new Response(null, { status: 200 })]);
  await r2SpendStore({ ...settings, jurisdiction: "eu", fetch: r2.fetch }).put("daily/2026-11-08.csv", "date\n");
  assert.equal(r2.requests[0].url, "https://acct.eu.r2.cloudflarestorage.com/the-overview-spend/daily/2026-11-08.csv");
});

test("reading back gives the text, or null when there is none", async () => {
  const r2 = fakeR2([new Response("date\n", { status: 200 }), new Response(null, { status: 404 })]);
  const store = r2SpendStore({ ...settings, fetch: r2.fetch });
  assert.equal(await store.get("daily/2026-11-08.csv"), "date\n");
  assert.equal(await store.get("daily/2026-11-07.csv"), null);
});

test("a refused write names the key and the status", async () => {
  const r2 = fakeR2([new Response(null, { status: 403 })]);
  await assert.rejects(r2SpendStore({ ...settings, fetch: r2.fetch }).put("daily/2026-11-08.csv", ""), {
    message: "R2 refused to store daily/2026-11-08.csv: 403",
  });
});
