import { formatClock } from "../../../util/formatClock.js";
import type { NoteTiming } from "./noteTiming.js";

// The design's "4 min read · 6 min listen · 11:38 video". The video term is dropped
// rather than guessed when the source carries no duration — docs/prototype/constraints.md.
// Undefined is as real an input as null here: an overview saved before durationMs existed
// has no such key, per the note in OverviewThumbnail.
export function readerMetaParts(
  timing: NoteTiming,
  durationMs: number | null | undefined,
): string[] {
  const parts = [`${timing.readMinutes} min read`, `${timing.listenMinutes} min listen`];
  if (Boolean(durationMs)) {
    parts.push(`${formatClock(durationMs! / 1000)} video`);
  }
  return parts;
}
