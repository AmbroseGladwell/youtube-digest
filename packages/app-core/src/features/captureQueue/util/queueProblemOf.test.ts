import { describe, expect, it } from "vitest";
import { TranscriptFetchError } from "@overview/transcripts";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";
import { queueProblemOf } from "./queueProblemOf.js";

describe("queueProblemOf", () => {
  it("names a video with no captions, however the ladder wrapped it", () => {
    const noCaptions = new TranscriptFetchError("this video has no captions", { failure: "no-captions" });
    expect(queueProblemOf(noCaptions)).toBe("noCaptions");
    expect(
      queueProblemOf(
        new NoTranscriptSourceError("No transcript source could fetch this video.", [
          { tier: "shared-cache", outcome: "no-answer" },
          { tier: "service", outcome: "failed", error: noCaptions },
        ]),
      ),
    ).toBe("noCaptions");
  });

  it("anything else is a failure the reader can try again", () => {
    expect(queueProblemOf(new Error("the model refused"))).toBe("failed");
  });
});
