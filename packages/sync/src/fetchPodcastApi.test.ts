import test from "node:test";
import assert from "node:assert/strict";
import { VideoId, type StoredTranscript } from "@overview/domain";
import { createFetchPodcastApi } from "./fetchPodcastApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const answering = (status: number, body: unknown) => {
  const sent: Array<{ url: string; body: unknown }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const transcript: StoredTranscript = {
  videoId: VideoId.parse("podcast:0123456789abcdef0123456789abcdef"),
  segments: [{ text: "Welcome back.", startMs: 0, endMs: 1500 }],
  generated: true,
  fetchedAt: "2026-11-13T09:00:00.000Z",
};

test("an episode's transcript is asked for with its feed, its guid and what the extension found", async () => {
  const { sent, fetch } = answering(200, transcript);
  const api = createFetchPodcastApi({ baseUrl: "https://overview.example", token: "bearer-1", fetch });
  const ask = { feedUrl: "https://feeds.example/show.xml", guid: "ep-guid", youTubeVideoId: "VIDEO000001" };

  assert.deepEqual(await api.transcript(ask), transcript);
  assert.deepEqual(sent, [{ url: "https://overview.example/api/podcasts/transcript", body: ask }]);
});

test("a match our server couldn't confirm rejects with the failure and says so", async () => {
  const { fetch } = answering(422, {
    error: { code: "transcript_unavailable", message: "not confirmed", details: { failure: "no-captions", match: "unconfirmed" } },
  });
  const api = createFetchPodcastApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.transcript({ feedUrl: "https://feeds.example/show.xml", guid: "g" }), (error) => {
    assert.ok(isSyncRequestError(error));
    assert.equal(error.details?.match, "unconfirmed");
    return true;
  });
});
