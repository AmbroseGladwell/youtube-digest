import type { QueuedCaptureProblem } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { NoTranscriptSourceError } from "../../transcripts/api/NoTranscriptSourceError.js";
import { resumesAtFrom } from "../../transcripts/util/resumeTime.js";
import type { QueueHold, QueueHoldReason } from "../types/QueueHold.js";

const BUSY_WAIT_SECONDS = 60;

// What a video the queue could not make is marked with, or that the queue itself should wait:
// a hold reason is never written onto a capture (docs/features/capture-queue.md).
export type QueueProblem = QueuedCaptureProblem | QueueHoldReason;

export const isQueueHoldReason = (problem: QueueProblem): problem is QueueHoldReason =>
  problem === "serverCap" || problem === "serverBusy";

function fetchErrorOf(error: unknown): TranscriptFetchError | null {
  if (error instanceof TranscriptFetchError) return error;
  if (error instanceof NoTranscriptSourceError) {
    return (
      error.failures
        .map((failure) => failure.error)
        .filter((cause): cause is TranscriptFetchError => cause instanceof TranscriptFetchError)
        .at(-1) ?? null
    );
  }
  return null;
}

// What the reader is told about a video the queue could not make, by kind, never by a
// provider's own words. The ladder's last rung to answer says why
// (docs/features/capture-queue.md, "Needs attention").
export function queueProblemOf(error: unknown): QueueProblem {
  const fetchError = fetchErrorOf(error);
  if (fetchError?.failure === "daily-cap") return "serverCap";
  if (fetchError?.failure === "rate-limited" && fetchError.sourceId === "service") return "serverBusy";
  if (fetchError?.failure === "no-captions") return "noCaptions";
  if (fetchError?.failure === "video-unavailable" || fetchError?.failure === "access-restricted") return "unavailable";
  return "failed";
}

// How long the queue waits: as long as the server said; when it didn't, until UTC midnight at
// the daily cap, or a minute when asked to slow down.
export function queueHoldOf(error: unknown, reason: QueueHoldReason, now: Date): QueueHold {
  const said = fetchErrorOf(error)?.retryAfterSeconds ?? null;
  const seconds = said ?? (reason === "serverBusy" ? BUSY_WAIT_SECONDS : null);
  return { reason, resumesAt: resumesAtFrom(seconds, now).getTime() };
}
