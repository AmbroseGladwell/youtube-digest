import test from "node:test";
import assert from "node:assert/strict";
import { VideoId, type StoredTranscript } from "@overview/domain";
import { createFetchSharedTranscriptApi } from "./fetchSharedTranscriptApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const answering = (status: number, body: unknown) => {
  const sent: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: String(input), headers: init?.headers as Record<string, string> });
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const transcriptOf = (videoId: string): StoredTranscript => ({
  videoId: VideoId.parse(videoId),
  segments: [{ text: "Hello and welcome.", startMs: 0, endMs: 3000 }],
  generated: false,
  fetchedAt: "2026-09-30T09:00:00.000Z",
});

const notFound = { error: { code: "not_found", message: "No shared transcript is kept for this video" } };

test("a cached video's transcript is read by its id, carrying no session", async () => {
  const transcript = transcriptOf("cached");
  const { sent, fetch } = answering(200, transcript);
  const api = createFetchSharedTranscriptApi({ baseUrl: "https://overview.example/", fetch });

  assert.deepEqual(await api.get(transcript.videoId), transcript);
  assert.equal(sent[0]!.url, `https://overview.example/api/shared-transcripts/${transcript.videoId}`);
  assert.equal(sent[0]!.headers.authorization, undefined);
});

test("a video the cache has no transcript of answers null", async () => {
  const { fetch } = answering(404, notFound);
  const api = createFetchSharedTranscriptApi({ baseUrl: "https://overview.example", fetch });

  assert.equal(await api.get(VideoId.parse("never-stored")), null);
});

test("any other refusal is thrown for the caller to judge", async () => {
  const { fetch } = answering(429, { error: { code: "too_many_requests", message: "Too many requests" } });
  const api = createFetchSharedTranscriptApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.get(VideoId.parse("busy")), (error) => isSyncRequestError(error) && error.code === "too_many_requests");
});
