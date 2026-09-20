import test from "node:test";
import assert from "node:assert/strict";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import type { YouTubeFetch, YouTubeFetchRequest, YouTubeFetchResponse } from "../YouTubeFetch.js";
import { fetchInnerTubeTranscript } from "./fetchInnerTubeTranscript.js";
import type { InnerTubeClientConfig } from "./InnerTubeClientConfig.js";
import {
  FIXTURE_VIDEO_ID,
  JSON3_WRITTEN,
  makeMetadataResponse,
  makePlayerResponse,
} from "./PlayerResponseFactory.testHelper.js";

const URL = `https://www.youtube.com/watch?v=${FIXTURE_VIDEO_ID}`;

const client = (clientName: string): InnerTubeClientConfig => ({
  clientName,
  clientVersion: "1",
  userAgent: `${clientName}-agent`,
});

const ok = (body: unknown): YouTubeFetchResponse => ({
  status: 200,
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function scriptedFetch(
  handle: (request: YouTubeFetchRequest, clientName: string | undefined) => YouTubeFetchResponse,
) {
  const requests: Array<{ url: string; clientName: string | undefined }> = [];
  const youTubeFetch: YouTubeFetch = (request) => {
    const clientName = request.headers["X-YouTube-Client-Name"];
    requests.push({ url: request.url, clientName });
    return Promise.resolve(handle(request, clientName));
  };
  const countOf = (clientName: string) =>
    requests.filter((entry) => entry.clientName === clientName).length;
  const captionCalls = () => requests.filter((entry) => entry.url.includes("timedtext")).length;
  return { youTubeFetch, requests, countOf, captionCalls };
}

const happyPath = () =>
  scriptedFetch((request, clientName) => {
    if (request.url.includes("timedtext")) return ok(JSON3_WRITTEN);
    return ok(clientName === "WEB" ? makeMetadataResponse() : makePlayerResponse());
  });

test("one player call serves the metadata and the captions, rather than one for each", async () => {
  const { youTubeFetch, countOf, captionCalls } = happyPath();

  const result = await fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, {
    clients: [client("ANDROID")],
  });

  assert.equal(countOf("ANDROID"), 1);
  assert.equal(captionCalls(), 1);
  assert.equal(result.video.title, "Why does every mammal get 1 billion heartbeats in their life?");
  assert.equal(result.transcript.length, 2);
});

test("the caption url asks for json3, replacing the format the track came with", async () => {
  const { youTubeFetch, requests } = happyPath();

  await fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, { clients: [client("ANDROID")] });

  const captionUrl = requests.find((entry) => entry.url.includes("timedtext"))?.url ?? "";
  assert.ok(captionUrl.includes("fmt=json3"));
  assert.ok(!captionUrl.includes("fmt=srv3"));
});

test("a written track is reported as written, and its words are the video's own", async () => {
  const { youTubeFetch } = happyPath();

  const result = await fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, {
    clients: [client("ANDROID")],
  });

  assert.equal(result.generated, false);
  assert.equal(result.transcript[0]?.startMs, 0);
});

test("a machine-heard track is reported as machine-heard", async () => {
  const written = makePlayerResponse();
  const tracks = written.captions!.playerCaptionsTracklistRenderer!.captionTracks!;
  const { youTubeFetch } = scriptedFetch((request, clientName) => {
    if (request.url.includes("timedtext")) return ok(JSON3_WRITTEN);
    if (clientName === "WEB") return ok(makeMetadataResponse());
    return ok(
      makePlayerResponse({
        captions: { playerCaptionsTracklistRenderer: { captionTracks: [tracks[1]!] } },
      }),
    );
  });

  const result = await fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, {
    clients: [client("ANDROID")],
  });

  assert.equal(result.generated, true);
});

test("a stale client falls through to the next one rather than failing the fetch", async () => {
  const { youTubeFetch, countOf } = scriptedFetch((request, clientName) => {
    if (request.url.includes("timedtext")) return ok(JSON3_WRITTEN);
    if (clientName === "ANDROID") return { status: 400, body: "" };
    return ok(clientName === "WEB" ? makeMetadataResponse() : makePlayerResponse());
  });

  const result = await fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, {
    clients: [client("ANDROID"), client("IOS")],
  });

  assert.equal(countOf("ANDROID"), 1);
  assert.equal(countOf("IOS"), 1);
  assert.equal(result.transcript.length, 2);
});

test("a video with no captions does not try the next client, which would find none either", async () => {
  const { youTubeFetch, countOf } = scriptedFetch((request, clientName) => {
    if (request.url.includes("timedtext")) return ok(JSON3_WRITTEN);
    if (clientName === "WEB") return ok(makeMetadataResponse());
    return ok(makePlayerResponse({ captions: undefined }));
  });

  await assert.rejects(
    () =>
      fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, {
        clients: [client("ANDROID"), client("IOS")],
      }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "no-captions");
      return true;
    },
  );
  assert.equal(countOf("IOS"), 0);
});

test("a removed video stops the whole ladder rather than being tried elsewhere", async () => {
  const { youTubeFetch } = scriptedFetch(() =>
    ok(
      makePlayerResponse({
        playabilityStatus: { status: "ERROR", reason: "This video has been removed by the uploader" },
      }),
    ),
  );

  await assert.rejects(
    () => fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, { clients: [client("ANDROID")] }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "video-unavailable");
      assert.equal(error.retryable, false);
      assert.ok(error.message.includes("removed by the uploader"));
      return true;
    },
  );
});

test("a rate limit is reported as one, so it is retried rather than treated as a dead video", async () => {
  const { youTubeFetch } = scriptedFetch(() => ({ status: 429, body: "" }));

  await assert.rejects(
    () => fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, { clients: [client("ANDROID")] }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "rate-limited");
      assert.equal(error.retryable, true);
      return true;
    },
  );
});

test("a publish date that cannot be had leaves the note without one, rather than failing it", async () => {
  const { youTubeFetch } = scriptedFetch((request, clientName) => {
    if (request.url.includes("timedtext")) return ok(JSON3_WRITTEN);
    if (clientName === "WEB") return { status: 500, body: "" };
    return ok(makePlayerResponse());
  });

  const result = await fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, {
    clients: [client("ANDROID")],
  });

  assert.equal(result.video.publishedAt, null);
  assert.equal(result.transcript.length, 2);
});

test("every failure leaves a TranscriptFetchError, never a raw throw from the fetch", async () => {
  const youTubeFetch: YouTubeFetch = () => Promise.reject(new Error("the worker was asleep"));

  await assert.rejects(
    () => fetchInnerTubeTranscript(youTubeFetch, FIXTURE_VIDEO_ID, URL, { clients: [client("ANDROID")] }),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.sourceId, "innertube");
      return true;
    },
  );
});
