import { describe, expect, it } from "vitest";
import { TranscriptFetchError } from "@overview/transcripts";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";
import { queueHoldOf, queueProblemOf } from "./queueProblemOf.js";

const ladderEnding = (last: TranscriptFetchError) =>
  new NoTranscriptSourceError("No transcript source could fetch this video.", [
    { tier: "shared-cache", outcome: "no-answer" },
    { tier: "service", outcome: "failed", error: last },
  ]);

describe("queueProblemOf", () => {
  it("names a video with no captions, however the ladder wrapped it", () => {
    const noCaptions = new TranscriptFetchError("this video has no captions", { failure: "no-captions" });
    expect(queueProblemOf(noCaptions)).toBe("noCaptions");
    expect(queueProblemOf(ladderEnding(noCaptions))).toBe("noCaptions");
  });

  it("our server's daily cap is the queue's to wait at, not the video's failure", () => {
    const cap = new TranscriptFetchError("spent", { failure: "daily-cap", sourceId: "service", retryAfterSeconds: 3600 });
    expect(queueProblemOf(cap)).toBe("serverCap");
    expect(queueProblemOf(ladderEnding(cap))).toBe("serverCap");
  });

  it("our server asking to slow down is the queue's to wait at too, but another rung's rate limit is the video's failure", () => {
    const busy = new TranscriptFetchError("wait", { failure: "rate-limited", sourceId: "service", retryAfterSeconds: 10 });
    expect(queueProblemOf(busy)).toBe("serverBusy");
    expect(queueProblemOf(ladderEnding(busy))).toBe("serverBusy");
    expect(queueProblemOf(new TranscriptFetchError("wait", { failure: "rate-limited", sourceId: "extension" }))).toBe("failed");
  });

  it("anything else is a failure the reader can try again", () => {
    expect(queueProblemOf(new Error("the model refused"))).toBe("failed");
  });
});

describe("queueHoldOf", () => {
  const now = new Date("2026-10-06T21:30:00.000Z");

  it("waits as long as the server said", () => {
    const cap = new TranscriptFetchError("spent", { failure: "daily-cap", sourceId: "service", retryAfterSeconds: 3600 });
    expect(queueHoldOf(ladderEnding(cap), "serverCap", now)).toEqual({ reason: "serverCap", resumesAt: Date.parse("2026-10-06T22:30:00.000Z") });
  });

  it("waits until UTC midnight when the server did not say", () => {
    const cap = new TranscriptFetchError("spent", { failure: "daily-cap", sourceId: "service" });
    expect(queueHoldOf(cap, "serverCap", now)).toEqual({ reason: "serverCap", resumesAt: Date.parse("2026-10-07T00:00:00.000Z") });
  });

  it("asked to slow down with no time given, waits a minute", () => {
    const busy = new TranscriptFetchError("wait", { failure: "rate-limited", sourceId: "service" });
    expect(queueHoldOf(busy, "serverBusy", now)).toEqual({ reason: "serverBusy", resumesAt: Date.parse("2026-10-06T21:31:00.000Z") });
  });
});
