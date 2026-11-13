import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { ArticleReadError } from "../api/ArticleReadError.js";
import { ChosenModelFailedError } from "../api/ChosenModelFailedError.js";
import type { RunError } from "../types/RunError.js";

export interface FetchedArticle {
  url: string;
  regenerating: boolean;
}

export function runErrorOf(error: Error, fetched: FetchedArticle | null = null, episode = false): RunError {
  if (episode && error instanceof TranscriptFetchError && error.failure === TranscriptFetchFailure.NO_CAPTIONS) {
    return { kind: "podcastNoTranscript" };
  }
  if (error instanceof ChosenModelFailedError) return { kind: "chosenModel", provider: error.provider, model: error.model };
  if (fetched !== null && error instanceof ArticleReadError) return { kind: "articleFetch", failure: error.failure, ...fetched };
  return { kind: "message", message: error.message };
}
