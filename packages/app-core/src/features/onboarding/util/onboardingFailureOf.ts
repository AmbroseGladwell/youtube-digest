import { isSyncRequestError } from "@overview/sync";
import type { PodcastReadFailure, TranscriptionFailure, VideoReadFailure } from "@overview/domain";
import { ArticleReadError, type ArticleFailure } from "../../newOverview/api/ArticleReadError.js";
import { PodcastNoTranscriptError, PodcastReadError } from "../../newOverview/api/PodcastReadError.js";
import { TranscriptionFailedError } from "../../podcasts/api/TranscriptionFailedError.js";
import { VideoReadError } from "../../newOverview/api/VideoReadError.js";
import { TranscriptionRefusedError } from "../../podcasts/api/TranscriptionRefusedError.js";

export type OnboardingFailure =
  | { kind: "read"; failure: ArticleFailure }
  | { kind: "videoRead"; reason: VideoReadFailure }
  | { kind: "podcastRead"; reason: PodcastReadFailure; showName: string | null }
  | { kind: "podcastNoTranscript" }
  | { kind: "podcastNeedsTranscribing"; episodeSeconds: number | null }
  | { kind: "transcriptionFailed"; reason: TranscriptionFailure | "no-audio" }
  | { kind: "transcriptionRefused"; refusal: "not-enough" | "too-long"; episodeSeconds: number | null }
  | { kind: "trialReads" }
  | { kind: "trialReadsAddress" }
  | { kind: "other" };

// Why onboarding's run failed, as far as the reader can act on it (designs 154l–154n).
export function onboardingFailureOf(error: unknown): OnboardingFailure {
  if (error instanceof ArticleReadError) return { kind: "read", failure: error.failure };
  if (error instanceof VideoReadError) return { kind: "videoRead", reason: error.reason };
  if (error instanceof PodcastReadError) return { kind: "podcastRead", reason: error.reason, showName: error.showName };
  if (error instanceof PodcastNoTranscriptError) {
    return error.transcribable
      ? { kind: "podcastNeedsTranscribing", episodeSeconds: error.episodeSeconds }
      : { kind: "podcastNoTranscript" };
  }
  if (error instanceof TranscriptionFailedError) return { kind: "transcriptionFailed", reason: error.reason };
  if (error instanceof TranscriptionRefusedError) {
    return { kind: "transcriptionRefused", refusal: error.refusal, episodeSeconds: error.episodeSeconds };
  }
  if (isSyncRequestError(error) && error.code === "too_many_requests") {
    if (error.details?.quota === "trial-reads") return { kind: "trialReads" };
    if (error.details?.quota === "trial-reads-address") return { kind: "trialReadsAddress" };
  }
  return { kind: "other" };
}
