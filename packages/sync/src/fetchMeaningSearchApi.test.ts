import test from "node:test";
import assert from "node:assert/strict";
import { createFetchMeaningSearchApi } from "./fetchMeaningSearchApi.js";

const answering = (status: number, body: unknown) => {
  const sent: string[] = [];
  const fetch = async (input: string | URL | Request): Promise<Response> => {
    sent.push(String(input));
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

test("a search is sent as a query and its matches come back closest first", async () => {
  const matches = [
    { overviewId: "a", similarity: 0.6 },
    { overviewId: "b", similarity: 0.4 },
  ];
  const { sent, fetch } = answering(200, { available: true, matches });
  const api = createFetchMeaningSearchApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.search("leaders who overstay"), { available: true, matches });
  assert.deepEqual(sent, ["https://overview.example/api/search/meaning?query=leaders%20who%20overstay"]);
});

test("a server that can't search by meaning says so", async () => {
  const { fetch } = answering(200, { available: false });
  const api = createFetchMeaningSearchApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.search("anything"), { available: false });
});
