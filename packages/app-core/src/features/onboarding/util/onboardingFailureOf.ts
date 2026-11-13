import { isSyncRequestError } from "@overview/sync";
import type { PodcastReadFailure } from "@overview/domain";
import { ArticleReadError, type ArticleFailure } from "../../newOverview/api/ArticleReadError.js";
import { PodcastNoTranscriptError, PodcastReadError } from "../../newOverview/api/PodcastReadError.js";

export type OnboardingFailure =
  | { kind: "read"; failure: ArticleFailure }
  | { kind: "podcastRead"; reason: PodcastReadFailure; showName: string | null }
  | { kind: "podcastNoTranscript" }
  | { kind: "trialReads" }
  | { kind: "trialReadsAddress" }
  | { kind: "other" };

// Why onboarding's run failed, as far as the reader can act on it (designs 154l–154n).
export function onboardingFailureOf(error: unknown): OnboardingFailure {
  if (error instanceof ArticleReadError) return { kind: "read", failure: error.failure };
  if (error instanceof PodcastReadError) return { kind: "podcastRead", reason: error.reason, showName: error.showName };
  if (error instanceof PodcastNoTranscriptError) return { kind: "podcastNoTranscript" };
  if (isSyncRequestError(error) && error.code === "too_many_requests") {
    if (error.details?.quota === "trial-reads") return { kind: "trialReads" };
    if (error.details?.quota === "trial-reads-address") return { kind: "trialReadsAddress" };
  }
  return { kind: "other" };
}
