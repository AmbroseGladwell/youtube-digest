import test from "node:test";
import assert from "node:assert/strict";
import { createFetchVideoApi } from "./fetchVideoApi.js";

const VIDEO = {
  id: "dQw4w9WgXcQ",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "Knife Skills in Ten Minutes",
  channel: "Kitchen Basics",
  description: null,
  durationMs: 725_000,
  publishedAt: null,
  thumbnailUrl: null,
};

test("a video is read by its id, and an answer from a server without the kind check still parses", async () => {
  const sent: Array<{ url: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ status: "read", video: VIDEO }), { status: 200 });
  };
  const api = createFetchVideoApi({ baseUrl: "https://overview.example", fetch });

  const read = await api.read("dQw4w9WgXcQ");

  assert.deepEqual(read, { status: "read", video: VIDEO, noteKind: null, transcript: null });
  assert.deepEqual(sent, [{ url: "https://overview.example/api/videos/read", body: { videoId: "dQw4w9WgXcQ" } }]);
});
