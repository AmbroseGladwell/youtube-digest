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

test("the check, a transcription asked for and asked after each go to their own address and are parsed", async () => {
  const ask = { feedUrl: "https://feeds.example/show.xml", guid: "ep-guid", searchYouTube: true };
  const checked = answering(200, {
    words: "none",
    transcription: { status: "needed", episodeSeconds: 6960, usage: { usedSeconds: 0, limitSeconds: 18000, episodes: 0 } },
  });
  const waiting = { status: "waiting", id: "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a11", episodeSeconds: 6960 };
  const started = answering(200, waiting);

  const check = await createFetchPodcastApi({ baseUrl: "https://overview.example", fetch: checked.fetch }).checkTranscript(ask);
  const api = createFetchPodcastApi({ baseUrl: "https://overview.example", fetch: started.fetch });
  await api.transcribe({ feedUrl: ask.feedUrl, guid: ask.guid });
  await api.transcription(waiting.id);

  assert.equal(check.words, "none");
  assert.deepEqual(checked.sent, [{ url: "https://overview.example/api/podcasts/transcript/check", body: ask }]);
  assert.deepEqual(
    started.sent.map(({ url }) => url),
    ["https://overview.example/api/podcasts/transcription", `https://overview.example/api/podcasts/transcription/${waiting.id}`],
  );
});
