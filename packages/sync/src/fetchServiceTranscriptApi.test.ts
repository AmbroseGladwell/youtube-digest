import test from "node:test";
import assert from "node:assert/strict";
import { VideoId, type StoredTranscript } from "@overview/domain";
import { createFetchServiceTranscriptApi } from "./fetchServiceTranscriptApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const answering = (status: number, body: unknown) => {
  const sent: Array<{ url: string; method: string | undefined; headers: Record<string, string> }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), method: init?.method, headers: init?.headers as Record<string, string> });
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const transcript: StoredTranscript = {
  videoId: VideoId.parse("tL9Lw250spc"),
  segments: [{ text: "Hello and welcome.", startMs: 0, endMs: 3000 }],
  generated: false,
  fetchedAt: "2026-10-05T09:00:00.000Z",
};

test("a transcript is asked for by posting its video id, with the session when there is one", async () => {
  const { sent, fetch } = answering(200, transcript);
  const api = createFetchServiceTranscriptApi({ baseUrl: "https://overview.example", token: "bearer-1", fetch });

  assert.deepEqual(await api.fetch(transcript.videoId), transcript);
  assert.equal(sent[0]!.url, `https://overview.example/api/service-transcripts/${transcript.videoId}`);
  assert.equal(sent[0]!.method, "POST");
  assert.equal(sent[0]!.headers.authorization, "Bearer bearer-1");
});

test("a transcript the server could not fetch rejects with the failure it named", async () => {
  const { fetch } = answering(422, {
    error: { code: "transcript_unavailable", message: "this video has no captions", details: { failure: "no-captions" } },
  });
  const api = createFetchServiceTranscriptApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(
    api.fetch(transcript.videoId),
    (error) => isSyncRequestError(error) && error.code === "transcript_unavailable" && error.details?.failure === "no-captions",
  );
});

test("the server says whether it fetches transcripts at all", async () => {
  const { sent, fetch } = answering(200, { available: true });
  const api = createFetchServiceTranscriptApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.status(), { available: true });
  assert.equal(sent[0]!.url, "https://overview.example/api/service-transcripts");
});
