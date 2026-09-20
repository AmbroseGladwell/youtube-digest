import test from "node:test";
import assert from "node:assert/strict";
import { SupadataError, type GeneralTranscriptParams, type Metadata, type TranscriptOrJobId } from "@supadata/js";
import { fetchSupadataTranscript } from "./fetchSupadataTranscript.js";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import type { SupadataClient } from "./SupadataClient.js";

const metadata: Metadata = {
  platform: "youtube",
  type: "video",
  id: "abc",
  url: "https://youtube.com/watch?v=abc",
  title: "A video",
  description: "A description.",
  author: { username: "channel", displayName: "A Channel", avatarUrl: "", verified: false },
  stats: { views: null, likes: null, comments: null, shares: null },
  media: { type: "video", url: "", duration: 60, width: 1, height: 1, thumbnailUrl: "" },
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  additionalData: {},
};

const nativeTranscript: TranscriptOrJobId = {
  content: [{ text: "Hello.", offset: 0, duration: 1000, lang: "en" }],
  lang: "en",
  availableLangs: ["en"],
};

function scriptedClient(options: {
  metadata?: () => Promise<Metadata>;
  transcript: Array<(params: GeneralTranscriptParams) => Promise<TranscriptOrJobId>>;
}) {
  const transcriptCalls: GeneralTranscriptParams[] = [];
  let transcriptCallIndex = 0;
  const client: SupadataClient = {
    metadata: options.metadata ?? (() => Promise.resolve(metadata)),
    transcript: Object.assign(
      async (params: GeneralTranscriptParams) => {
        transcriptCalls.push(params);
        const behaviour = options.transcript[transcriptCallIndex++];
        if (!behaviour) throw new Error("scriptedClient ran out of scripted transcript calls");
        return behaviour(params);
      },
      { getJobStatus: () => Promise.reject(new Error("not used in this test")) },
    ),
  };
  return { client, transcriptCalls };
}

test("the happy path: metadata plus a native transcript, no fallback needed", async () => {
  const { client, transcriptCalls } = scriptedClient({ transcript: [() => Promise.resolve(nativeTranscript)] });
  const result = await fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc");
  assert.equal(result.generated, false);
  assert.equal(result.video.channel, "A Channel");
  assert.deepEqual(result.transcript, [{ text: "Hello.", startMs: 0, endMs: 1000 }]);
  assert.equal(transcriptCalls[0]?.mode, "native");
});

test("no native captions falls back to the generate (ASR) mode automatically", async () => {
  const { client, transcriptCalls } = scriptedClient({
    transcript: [
      () => Promise.reject(new SupadataError({ error: "transcript-unavailable" })),
      () => Promise.resolve(nativeTranscript),
    ],
  });
  const result = await fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc");
  assert.equal(result.generated, true);
  assert.equal(transcriptCalls[0]?.mode, "native");
  assert.equal(transcriptCalls[1]?.mode, "generate");
});

test("the generate fallback can be turned off, surfacing the no-captions error instead of spending ASR credits", async () => {
  const { client } = scriptedClient({
    transcript: [() => Promise.reject(new SupadataError({ error: "transcript-unavailable" }))],
  });
  await assert.rejects(
    () => fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc", { allowGeneratedFallback: false }),
    TranscriptFetchError,
  );
});

test("a transient error gets exactly one retry before succeeding", async () => {
  const { client, transcriptCalls } = scriptedClient({
    transcript: [
      () => Promise.reject(new SupadataError({ error: "internal-error" })),
      () => Promise.resolve(nativeTranscript),
    ],
  });
  const result = await fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc");
  assert.equal(result.generated, false);
  assert.equal(transcriptCalls.length, 2);
});

test("a non-retryable error (invalid request) fails on the first attempt, not after a wasted retry", async () => {
  const { client, transcriptCalls } = scriptedClient({
    transcript: [() => Promise.reject(new SupadataError({ error: "invalid-request" }))],
  });
  await assert.rejects(() => fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc"), TranscriptFetchError);
  assert.equal(transcriptCalls.length, 1);
});

// The three below pin bugs that were live before the port. Each one cost money or told
// a caller something untrue (docs/features/transcript-retrieval.md).

test("a failure in the generate fallback is still a TranscriptFetchError, not a raw provider error", async () => {
  const { client } = scriptedClient({
    transcript: [
      () => Promise.reject(new SupadataError({ error: "transcript-unavailable" })),
      () => Promise.reject(new SupadataError({ error: "upgrade-required" })),
    ],
  });
  await assert.rejects(
    () => fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc"),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "source-unsupported");
      return true;
    },
  );
});

test("a metadata failure is a TranscriptFetchError too, so callers never see a provider error", async () => {
  const { client } = scriptedClient({
    metadata: () => Promise.reject(new SupadataError({ error: "not-found" })),
    transcript: [],
  });
  await assert.rejects(
    () => fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc"),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "video-unavailable");
      return true;
    },
  );
});

test("a rate limit is not retried into a second charge on a non-retryable code", async () => {
  const { client, transcriptCalls } = scriptedClient({
    transcript: [() => Promise.reject(new SupadataError({ error: "unauthorized" }))],
  });
  await assert.rejects(() => fetchSupadataTranscript(client, "https://youtube.com/watch?v=abc"), TranscriptFetchError);
  assert.equal(transcriptCalls.length, 1);
});
