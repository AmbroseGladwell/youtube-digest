import type { PlaylistOrigin, PlaylistPace, QueuedCapture } from "@overview/domain";
import { resumeTimeText } from "../../transcripts/util/resumeTime.js";
import type { CaptureQueueController } from "../useCaptureQueue.js";
import type { QueueRowState } from "../components/QueueRow/QueueRow.js";
import { monthResumeDate } from "./monthHoldCopy.js";

export interface QueueRowModel {
  capture: QueuedCapture;
  state: QueueRowState;
  resumeTime?: string;
}

// What the queue can make now, after the one being made, each with the words its row shows:
// the first is Next, the rest Waiting, and a video the reader chose says so. Every one says
// so when there is no key or, signed out past the trial, no account to make it with, and
// every one says when it continues while the queue waits at a limit. What waits on a pace is
// grouped by playlist instead (pacedGroups), except at the month's limit, which wins over every
// pace: then it all waits for the month, in one list (design 95q).
export function waitingRows(
  queue: Pick<CaptureQueueController, "ready" | "tomorrow" | "making" | "needsKey" | "trialSpent" | "hold">,
): QueueRowModel[] {
  const makingId = queue.making?.capture.videoId ?? null;
  if (queue.hold?.reason === "monthSpent" && !queue.trialSpent && !queue.needsKey) {
    const resumeTime = monthResumeDate(queue.hold);
    return [...queue.ready, ...queue.tomorrow]
      .filter((capture) => capture.videoId !== makingId)
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
      .map((capture) => ({ capture, state: "monthSpent", resumeTime }));
  }
  const resumeTime = queue.hold === null ? undefined : resumeTimeText(new Date(queue.hold.resumesAt));
  return queue.ready
    .filter((capture) => capture.videoId !== makingId)
    .map((capture, index) => ({
      capture,
      state: queue.trialSpent
        ? "trialSpent"
        : queue.needsKey
          ? "noKey"
          : resumeTime !== undefined
            ? "held"
            : capture.chosenAt !== null
              ? index === 0
                ? "chosenNext"
                : "chosen"
              : index === 0
                ? "next"
                : "waiting",
      ...(resumeTime === undefined ? {} : { resumeTime }),
    }));
}

export interface PacedGroup {
  playlist: PlaylistOrigin;
  pace: PlaylistPace;
  madeToday: number;
  captures: QueuedCapture[];
}

// Videos waiting on their playlist's pace, or for the reader, together by playlist in the
// order their oldest waits (95aa, 95aj).
export function pacedGroups(
  captures: readonly QueuedCapture[],
  queue: Pick<CaptureQueueController, "paceOf" | "madeToday">,
): PacedGroup[] {
  const groups = new Map<string, PacedGroup>();
  for (const capture of captures) {
    const { id } = capture.fromPlaylist;
    const group = groups.get(id) ?? { playlist: capture.fromPlaylist, pace: queue.paceOf(id), madeToday: queue.madeToday(id), captures: [] };
    group.captures.push(capture);
    groups.set(id, group);
  }
  return [...groups.values()];
}

export function attentionSummary(attention: QueuedCapture[]): string {
  const failed = attention.filter((capture) => capture.status === "failed").length;
  const skipped = attention.length - failed;
  return [failed > 0 ? `${failed} failed` : null, skipped > 0 ? `${skipped} skipped` : null]
    .filter((part): part is string => part !== null)
    .join(", ");
}

const playlistNames = (captures: readonly QueuedCapture[]) =>
  new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format([...new Set(captures.map((capture) => capture.fromPlaylist.title))]);

// The library group's foot for what waits on a pace or for the reader: a count and whose,
// never warning ink, because nothing is wrong (95ab).
export function pacedSummary(queue: Pick<CaptureQueueController, "tomorrow" | "forYou">): { tomorrow: string | null; forYou: string | null } {
  const reached = queue.tomorrow.length === 0 ? null : playlistNames(queue.tomorrow);
  return {
    tomorrow: reached === null ? null : `${reached} ${new Set(queue.tomorrow.map((capture) => capture.fromPlaylist.id)).size === 1 ? "has" : "have"} reached today’s pace`,
    forYou: queue.forYou.length === 0 ? null : `From ${playlistNames(queue.forYou)}`,
  };
}
