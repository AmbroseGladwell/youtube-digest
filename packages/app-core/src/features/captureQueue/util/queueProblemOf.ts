import type { QueuedCaptureProblem } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { isSyncRequestError } from "@overview/sync";
import { monthResetOf } from "../../newOverview/util/monthReset.js";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";
import { resumesAtFrom } from "../../transcripts/util/resumeTime.js";
import type { QueueHold, QueueHoldReason } from "../types/QueueHold.js";

const BUSY_WAIT_SECONDS = 60;

// Why a hold reason never lands on a capture: docs/features/capture-queue.md, "Waiting at a limit".
export type QueueProblem = QueuedCaptureProblem | QueueHoldReason;

export const isQueueHoldReason = (problem: QueueProblem): problem is QueueHoldReason =>
  problem === "serverCap" || problem === "serverBusy" || problem === "monthSpent";

const MONTH_QUOTAS = new Set(["ours", "own"]);

const resetsOnOf = (details: Record<string, unknown> | undefined): string => {
  const resetsOn = details?.resetsOn;
  return typeof resetsOn === "string" ? resetsOn : "";
};

const monthSpentResetOf = (error: unknown): string | null =>
  isSyncRequestError(error) && error.code === "too_many_requests" && MONTH_QUOTAS.has(String(error.details?.quota))
    ? resetsOnOf(error.details)
    : null;

const fetchErrorOf = (error: unknown): TranscriptFetchError | null => {
  if (error instanceof TranscriptFetchError) {
    return error;
  }
  if (error instanceof NoTranscriptSourceError) {
    return (
      error.failures
        .map((failure) => failure.error)
        .filter((cause): cause is TranscriptFetchError => cause instanceof TranscriptFetchError)
        .at(-1) ?? null
    );
  }
  return null;
};

// Named by kind, never in a provider's words: docs/features/capture-queue.md, "Needs attention".
export const queueProblemOf = (error: unknown): QueueProblem => {
  if (monthSpentResetOf(error) !== null) {
    return "monthSpent";
  }
  const fetchError = fetchErrorOf(error);
  if (fetchError?.failure === "daily-cap") {
    return "serverCap";
  }
  if (fetchError?.failure === "rate-limited" && fetchError.sourceId === "service") {
    return "serverBusy";
  }
  if (fetchError?.failure === "no-captions") {
    return "noCaptions";
  }
  if (fetchError?.failure === "video-unavailable" || fetchError?.failure === "access-restricted") {
    return "unavailable";
  }
  return "failed";
};

// How long each reason waits: docs/features/capture-queue.md, "Waiting at a limit".
export const queueHoldOf = (error: unknown, reason: QueueHoldReason, now: Date): QueueHold => {
  if (reason === "monthSpent") {
    return { reason, resumesAt: monthResetOf(monthSpentResetOf(error), now).getTime() };
  }
  const said = fetchErrorOf(error)?.retryAfterSeconds ?? null;
  const seconds = said ?? (reason === "serverBusy" ? BUSY_WAIT_SECONDS : null);
  return { reason, resumesAt: resumesAtFrom(seconds, now).getTime() };
};
