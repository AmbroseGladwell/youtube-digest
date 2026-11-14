import test from "node:test";
import assert from "node:assert/strict";
import { ShareToken, shareSnapshot } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";
import { createFetchSampleApi } from "./fetchSampleApi.js";

const TOKEN = ShareToken.parse("k7Qm2x9RfTabcdef");

const answering = (body: unknown) => {
  const urls: string[] = [];
  const fetch = async (input: string | URL | Request): Promise<Response> => {
    urls.push(String(input));
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { urls, fetch };
};

test("Start's samples are listed signed out, by their notes", async () => {
  const snapshot = shareSnapshot({ overview: makeOverview(), narration: null });
  const { urls, fetch } = answering({ samples: [{ token: TOKEN, note: snapshot.note }] });
  const api = createFetchSampleApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.list(), [{ token: TOKEN, note: snapshot.note }]);
  assert.equal(urls[0], "https://overview.example/api/samples");
});

test("a chosen sample is fetched whole, by its token", async () => {
  const snapshot = shareSnapshot({ overview: makeOverview(), narration: null });
  const { urls, fetch } = answering(snapshot);
  const api = createFetchSampleApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.get(TOKEN), snapshot);
  assert.equal(urls[0], `https://overview.example/api/samples/${TOKEN}`);
});
