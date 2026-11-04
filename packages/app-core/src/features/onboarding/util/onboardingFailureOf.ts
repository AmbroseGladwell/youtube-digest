import { isSyncRequestError } from "@overview/sync";
import { ArticleReadError, type ArticleFailure } from "../../newOverview/api/ArticleReadError.js";

export type OnboardingFailure =
  | { kind: "read"; failure: ArticleFailure }
  | { kind: "trialReads" }
  | { kind: "trialReadsAddress" }
  | { kind: "other" };

// Why onboarding's run failed, as far as the reader can act on it (designs 154l–154n).
export function onboardingFailureOf(error: unknown): OnboardingFailure {
  if (error instanceof ArticleReadError) return { kind: "read", failure: error.failure };
  if (isSyncRequestError(error) && error.code === "too_many_requests") {
    if (error.details?.quota === "trial-reads") return { kind: "trialReads" };
    if (error.details?.quota === "trial-reads-address") return { kind: "trialReadsAddress" };
  }
  return { kind: "other" };
}
