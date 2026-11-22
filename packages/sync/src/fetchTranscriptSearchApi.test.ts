import test from "node:test";
import assert from "node:assert/strict";
import { createFetchTranscriptSearchApi } from "./fetchTranscriptSearchApi.js";

test("a search is sent as a query, quotes and all, and its matches come back as the server ordered them", async () => {
  const sent: string[] = [];
  const matches = [
    { overviewId: "a", mentions: 2, moments: [{ startMs: 65_000, text: "Zatsiorsky wrote it.", marks: [{ start: 0, end: 10 }] }] },
  ];
  const fetch = async (input: string | URL | Request): Promise<Response> => {
    sent.push(String(input));
    return new Response(JSON.stringify({ matches }), { status: 200 });
  };
  const api = createFetchTranscriptSearchApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.search('"wrote it"'), { matches });
  assert.deepEqual(sent, ["https://overview.example/api/search/transcripts?query=%22wrote%20it%22"]);
});
