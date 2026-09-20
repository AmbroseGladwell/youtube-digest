import { describe, expect, it } from "vitest";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { transcriptFailureMessage } from "./transcriptFailureMessage.js";

describe("transcriptFailureMessage", () => {
  it("says nothing could be asked when no source was ever ready", () => {
    expect(
      transcriptFailureMessage([
        { tier: "extension", outcome: "unavailable" },
        { tier: "supadata", outcome: "unavailable" },
      ]),
    ).toBe("Nothing here can fetch a transcript.");
  });

  it("reports the failure of a source that actually tried, not the ones that stood down", () => {
    const message = transcriptFailureMessage([
      { tier: "extension", outcome: "unavailable" },
      {
        tier: "supadata",
        outcome: "failed",
        error: new TranscriptFetchError("This video has no captions.", {
          failure: TranscriptFetchFailure.NO_CAPTIONS,
        }),
      },
    ]);

    expect(message).toBe("This video has no captions.");
  });

  it("prefers the last source to fail, because it is the one that ran out of options", () => {
    const message = transcriptFailureMessage([
      {
        tier: "extension",
        outcome: "failed",
        error: new TranscriptFetchError("YouTube would not answer.", {
          failure: TranscriptFetchFailure.SOURCE_BLOCKED,
        }),
      },
      {
        tier: "supadata",
        outcome: "failed",
        error: new TranscriptFetchError("Out of credits.", {
          failure: TranscriptFetchFailure.SOURCE_UNSUPPORTED,
        }),
      },
    ]);

    expect(message).toBe("Out of credits.");
  });

  it("falls back to a plain sentence when a source failed with something unrecognisable", () => {
    expect(
      transcriptFailureMessage([{ tier: "supadata", outcome: "failed", error: new Error("boom") }]),
    ).toBe("No transcript source could fetch this video.");
  });
});
