import type { CaptureFailure } from "@overview/domain";
import { GenerationError } from "@overview/generation";
import { TranscriptFetchError } from "@overview/transcripts";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";
import { ArticleReadError } from "../api/ArticleReadError.js";
import { ChosenModelFailedError } from "../api/ChosenModelFailedError.js";

const ARTICLE_FAILURE = {
  declined: "article-declined",
  paywalled: "article-paywalled",
  "nothing-readable": "article-not-readable",
  "not-loaded": "article-not-loaded",
  "no-access": "article-no-access",
  blocked: "article-blocked",
  "not-found": "article-not-found",
  "no-answer": "article-no-answer",
  unfinished: "article-unfinished",
} as const;

// By name, never by message, which can quote a provider; after the transcript, any failure is generation's.
export const captureFailureOf = (error: unknown, { transcriptResolved }: { transcriptResolved: boolean }): CaptureFailure => {
  if (error instanceof ArticleReadError) {
    return ARTICLE_FAILURE[error.failure.reason];
  }
  if (error instanceof TranscriptFetchError) {
    return error.failure;
  }
  if (error instanceof NoTranscriptSourceError) {
    return "noTranscriptSource";
  }
  if (error instanceof ChosenModelFailedError) {
    return "model-refused";
  }
  if (error instanceof GenerationError || transcriptResolved) {
    return "generation";
  }
  return "unknown";
};
