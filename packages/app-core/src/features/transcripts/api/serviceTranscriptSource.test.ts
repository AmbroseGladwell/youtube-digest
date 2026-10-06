import { describe, expect, it } from "vitest";
import { VideoId, type StoredTranscript } from "@overview/domain";
import { SyncRequestError, SyncTransportError, type ServiceTranscriptApi } from "@overview/sync";
import { TranscriptFetchError } from "@overview/transcripts";
import { serviceTranscriptSource } from "./serviceTranscriptSource.js";

const VIDEO_ID = "tL9Lw250spc";
const URL = `https://www.youtube.com/watch?v=${VIDEO_ID}&si=shared`;
const context = { readHeldTranscript: () => Promise.resolve(null) };

const transcript: StoredTranscript = {
  videoId: VideoId.parse(VIDEO_ID),
  segments: [{ text: "Hello and welcome.", startMs: 0, endMs: 3000 }],
  generated: true,
  fetchedAt: "2026-10-05T09:00:00.000Z",
  video: {
    id: VideoId.parse(VIDEO_ID),
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    title: "A video",
    channel: "A channel",
    durationMs: 60_000,
    publishedAt: null,
    thumbnailUrl: null,
    description: null,
  },
};

const api = (overrides: Partial<ServiceTranscriptApi>): ServiceTranscriptApi => ({
  status: () => Promise.resolve({ available: true }),
  fetch: () => Promise.resolve(transcript),
  ...overrides,
});

const rejectionOf = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error);

describe("serviceTranscriptSource", () => {
  it("costs us rather than nothing, so the background prefetch never reaches it", () => {
    expect(serviceTranscriptSource(api({})).cost).toBe("metered");
  });

  it("answers with the server's copy, under the url this reader pasted", async () => {
    const resolved = await serviceTranscriptSource(api({})).resolve(URL, context);

    expect(resolved?.video.url).toBe(URL);
    expect(resolved?.transcript).toEqual(transcript.segments);
    expect(resolved?.generated).toBe(true);
  });

  it("is ready only when the server says it fetches transcripts", async () => {
    expect(await serviceTranscriptSource(api({ status: () => Promise.resolve({ available: false }) })).isReady()).toBe(false);
    expect(await serviceTranscriptSource(api({ status: () => Promise.reject(new SyncTransportError("down")) })).isReady()).toBe(false);
    expect(await serviceTranscriptSource(api({})).isReady()).toBe(true);
  });

  it("passes on the failure the server named, so the ladder and the reader see it", async () => {
    const error = await rejectionOf(
      serviceTranscriptSource(
        api({
          fetch: () =>
            Promise.reject(
              new SyncRequestError("transcript_unavailable", 422, "Our server has fetched all it can today.", {
                failure: "budget-exhausted",
              }),
            ),
        }),
      ).resolve(URL, context),
    );

    expect(error).toBeInstanceOf(TranscriptFetchError);
    expect((error as TranscriptFetchError).failure).toBe("budget-exhausted");
    expect((error as TranscriptFetchError).message).toBe("Our server has fetched all it can today.");
  });

  it("names our server's daily cap as its own failure, carrying when it resets and what else can fetch", async () => {
    const error = await rejectionOf(
      serviceTranscriptSource(
        api({
          fetch: () =>
            Promise.reject(new SyncRequestError("too_many_requests", 429, "spent", { retryAfterSeconds: 60, daily: true })),
        }),
      ).resolve(URL, context),
    );

    expect((error as TranscriptFetchError).failure).toBe("daily-cap");
    expect((error as TranscriptFetchError).retryAfterSeconds).toBe(60);
    expect((error as TranscriptFetchError).message).toMatch(/after \d\d:\d\d, or the extension can fetch this one now/);
  });

  it("an ordinary per-minute refusal is a rate limit with its wait, not the daily cap", async () => {
    const error = await rejectionOf(
      serviceTranscriptSource(
        api({ fetch: () => Promise.reject(new SyncRequestError("too_many_requests", 429, "slow down", { retryAfterSeconds: 10 })) }),
      ).resolve(URL, context),
    );

    expect((error as TranscriptFetchError).failure).toBe("rate-limited");
    expect((error as TranscriptFetchError).retryAfterSeconds).toBe(10);
    expect((error as TranscriptFetchError).message).toMatch(/^Our server asked us to wait a moment\. It can again after \d\d:\d\d/);
  });

  it("a refusal that gave no wait is tried again after a minute", async () => {
    const error = await rejectionOf(
      serviceTranscriptSource(api({ fetch: () => Promise.reject(new SyncRequestError("too_many_requests", 429, "slow down")) })).resolve(URL, context),
    );

    expect((error as TranscriptFetchError).retryAfterSeconds).toBe(60);
  });

  it("falls through without a word when the server has the service off", async () => {
    const resolved = await serviceTranscriptSource(
      api({ fetch: () => Promise.reject(new SyncRequestError("unavailable", 503, "off")) }),
    ).resolve(URL, context);

    expect(resolved).toBeNull();
  });
});
