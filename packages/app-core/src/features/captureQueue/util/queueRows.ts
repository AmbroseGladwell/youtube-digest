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

const waitingState = (needsKey: boolean, held: boolean, chosen: boolean, first: boolean): QueueRowState => {
  if (needsKey) {
    return "noKey";
  }
  if (held) {
    return "held";
  }
  if (chosen) {
    return first ? "chosenNext" : "chosen";
  }
  return first ? "next" : "waiting";
};

// At the month's limit paced videos join this one list: docs/features/capture-queue.md, "At the month's limit".
export const waitingRows = (
  queue: Pick<CaptureQueueController, "ready" | "tomorrow" | "making" | "needsKey" | "hold">,
): QueueRowModel[] => {
  const makingId = queue.making?.capture.videoId ?? null;
  if (queue.hold?.reason === "monthSpent" && !queue.needsKey) {
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
      state: waitingState(queue.needsKey, resumeTime !== undefined, capture.chosenAt !== null, index === 0),
      ...(resumeTime === undefined ? {} : { resumeTime }),
    }));
};

export interface PacedGroup {
  playlist: PlaylistOrigin;
  pace: PlaylistPace;
  madeToday: number;
  captures: QueuedCapture[];
}

export const pacedGroups = (
  captures: readonly QueuedCapture[],
  queue: Pick<CaptureQueueController, "paceOf" | "madeToday">,
): PacedGroup[] => {
  const groups = new Map<string, PacedGroup>();
  for (const capture of captures) {
    const { id } = capture.fromPlaylist;
    const group = groups.get(id) ?? {
      playlist: capture.fromPlaylist,
      pace: queue.paceOf(id),
      madeToday: queue.madeToday(id),
      captures: [],
    };
    group.captures.push(capture);
    groups.set(id, group);
  }
  return [...groups.values()];
};

export const attentionSummary = (attention: QueuedCapture[]): string => {
  const failed = attention.filter((capture) => capture.status === "failed").length;
  const skipped = attention.length - failed;
  return [failed > 0 ? `${failed} failed` : null, skipped > 0 ? `${skipped} skipped` : null]
    .filter((part): part is string => part !== null)
    .join(", ");
};

const playlistNames = (captures: readonly QueuedCapture[]) =>
  new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format([
    ...new Set(captures.map((capture) => capture.fromPlaylist.title)),
  ]);

export interface PacedSummary {
  tomorrow: string | null;
  forYou: string | null;
}

export const pacedSummary = (queue: Pick<CaptureQueueController, "tomorrow" | "forYou">): PacedSummary => {
  const reached = queue.tomorrow.length === 0 ? null : playlistNames(queue.tomorrow);
  return {
    tomorrow:
      reached === null
        ? null
        : `${reached} ${new Set(queue.tomorrow.map((capture) => capture.fromPlaylist.id)).size === 1 ? "has" : "have"} reached today’s pace`,
    forYou: queue.forYou.length === 0 ? null : `From ${playlistNames(queue.forYou)}`,
  };
};
