import type { PodcastEpisode, PodcastTranscription, StoredTranscript } from "@overview/domain";
import { isSyncRequestError, type PodcastApi } from "@overview/sync";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { GenerationCancelledError } from "../../newOverview/api/GenerationCancelledError.js";
import { TranscriptionFailedError } from "./TranscriptionFailedError.js";
import { TranscriptionRefusedError } from "./TranscriptionRefusedError.js";

export type TranscriptionProgress = "starting" | "transcribing";

export interface TranscribeEpisodeOptions {
  onProgress?: ((progress: TranscriptionProgress) => void) | undefined;
  isCancelled?: (() => boolean) | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

const POLL_MS = 3000;
// A connection that drops for a moment while the reader waits isn't the transcription failing.
const MOST_MISSED_POLLS = 3;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const refusalOf = (error: unknown): Error => {
  if (!isSyncRequestError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }
  if (error.code === "too_many_requests" && error.details?.quota === "transcription") {
    return new TranscriptionRefusedError("not-enough", null);
  }
  if (error.details?.transcription === "too-long") {
    const seconds = error.details.episodeSeconds;
    return new TranscriptionRefusedError("too-long", typeof seconds === "number" ? seconds : null);
  }
  if (error.details?.transcription === "no-audio") {
    return new TranscriptionFailedError("no-audio");
  }
  if (error.code === "transcript_unavailable") {
    return new TranscriptFetchError(error.message, {
      failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE,
      sourceId: "podcast",
      cause: error,
    });
  }
  return error;
};

// The episode's own audio transcribed on our GPU host, which the reader chose: asked for once, then
// asked after every few seconds until the words are ready. Waiting for a card and transcribing are
// told apart, since only the second is the minute the words take (design 305e). Asking again for
// one transcribed in the last day, or on its way, joins it and costs nothing.
export const transcribeEpisode = async (
  api: Pick<PodcastApi, "transcribe" | "transcription">,
  episode: PodcastEpisode,
  { onProgress, isCancelled, sleep = wait }: TranscribeEpisodeOptions = {},
): Promise<{ transcript: StoredTranscript }> => {
  let state: PodcastTranscription = await api.transcribe({ feedUrl: episode.feedUrl, guid: episode.guid }).catch((error: unknown) => {
    throw refusalOf(error);
  });
  let told: TranscriptionProgress | null = null;
  let missed = 0;
  for (;;) {
    if (state.status === "ready") {
      return { transcript: state.transcript };
    }
    if (state.status === "failed") {
      throw new TranscriptionFailedError(state.reason);
    }
    const progress = state.status === "transcribing" ? "transcribing" : "starting";
    if (progress !== told) {
      told = progress;
      onProgress?.(progress);
    }
    await sleep(POLL_MS);
    if (isCancelled?.()) {
      throw new GenerationCancelledError();
    }
    try {
      state = await api.transcription(state.id);
      missed = 0;
    } catch (error) {
      missed += 1;
      if (missed > MOST_MISSED_POLLS || (isSyncRequestError(error) && error.code === "not_found")) {
        throw error;
      }
    }
  }
};
