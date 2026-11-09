import { describe, expect, it } from "vitest";
import { GenerationError, ModelRefusedError } from "@overview/generation";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";
import { ArticleReadError } from "../api/ArticleReadError.js";
import { ChosenModelFailedError } from "../api/ChosenModelFailedError.js";
import { captureFailureOf } from "./captureFailureOf.js";

const before = { transcriptResolved: false };

describe("captureFailureOf", () => {
  it("names a failed run by what went wrong, never by its message", () => {
    expect(
      captureFailureOf(new TranscriptFetchError("Video gone", { failure: TranscriptFetchFailure.VIDEO_UNAVAILABLE }), before),
    ).toBe("video-unavailable");
    expect(captureFailureOf(new NoTranscriptSourceError("No rung answered", []), before)).toBe("noTranscriptSource");
    expect(captureFailureOf(new GenerationError("The note didn't parse"), before)).toBe("generation");
    expect(captureFailureOf(new Error("Something else entirely"), before)).toBe("unknown");
  });

  it("names an unreadable article by why, even after the page was reached", () => {
    expect(captureFailureOf(new ArticleReadError({ status: "failed", reason: "paywalled" }), before)).toBe("article-paywalled");
    expect(captureFailureOf(new ArticleReadError({ status: "failed", reason: "declined" }), before)).toBe("article-declined");
  });

  it("names a model the reader chose failing apart from the generation failing", () => {
    const refused = new ChosenModelFailedError("anthropic", "claude-haiku-5-5", new ModelRefusedError(400, "grammar too large"));
    expect(captureFailureOf(refused, { transcriptResolved: true })).toBe("model-refused");
  });

  it("counts anything thrown once the transcript is in hand as the generation failing", () => {
    expect(captureFailureOf(new Error("401 from the model's API"), { transcriptResolved: true })).toBe("generation");
  });
});
