import type { SharedNote } from "./SharedNote.js";
import { noteTiming } from "./noteTiming.js";
import { overviewNoteLines } from "./overviewNoteLines.js";

export type OverviewTimeSaved =
  | { kind: "counted"; minutes: number; lessPartToWatch: boolean }
  | { kind: "withoutLength" }
  | { kind: "watchVerdict" };

export interface TimeSavedSummary {
  minutes: number;
  counted: number;
  lessPartToWatch: number;
  withoutLength: number;
  watchVerdict: number;
}

const MS_PER_MINUTE = 60_000;

// The video's length at 1×, minus the reading time the reader is shown, minus any part
// the verdict says to watch. Whole minutes, so the totals add up to the pills
// (docs/features/time-saved.md, "Counted honestly").
export function overviewTimeSaved(overview: SharedNote): OverviewTimeSaved {
  const watchAnyway = overview.watchAnyway;
  if (watchAnyway?.answer === "yes") {
    return { kind: "watchVerdict" };
  }
  const durationMs = overview.video.durationMs;
  if (!durationMs) {
    return { kind: "withoutLength" };
  }
  const readingMs = noteTiming(overviewNoteLines(overview)).readMinutes * MS_PER_MINUTE;
  const range = watchAnyway?.answer === "partial" ? watchAnyway.range : null;
  const toWatchMs = range === null ? 0 : Math.max(0, range.endMs - range.startMs);
  return {
    kind: "counted",
    minutes: Math.max(0, Math.floor((durationMs - readingMs - toWatchMs) / MS_PER_MINUTE)),
    lessPartToWatch: range !== null,
  };
}

export function timeSavedSummary(
  entries: ReadonlyArray<{ overview: SharedNote; state: { read: boolean } }>,
): TimeSavedSummary {
  const summary: TimeSavedSummary = { minutes: 0, counted: 0, lessPartToWatch: 0, withoutLength: 0, watchVerdict: 0 };
  for (const { overview, state } of entries) {
    if (!state.read) {
      continue;
    }
    const saved = overviewTimeSaved(overview);
    if (saved.kind === "counted") {
      summary.minutes += saved.minutes;
      summary.counted += 1;
      summary.lessPartToWatch += saved.lessPartToWatch ? 1 : 0;
    } else {
      summary[saved.kind] += 1;
    }
  }
  return summary;
}
