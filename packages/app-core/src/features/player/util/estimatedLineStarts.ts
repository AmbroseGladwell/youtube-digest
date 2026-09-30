import { noteTiming, type NoteLine } from "@overview/domain";

export interface LineTimings {
  lineStarts: number[];
  durationSeconds: number;
}

// The pacer's clock: each line held for as long as it would take to say. Only ever shown
// with a ~, because nobody measured it (docs/prototype/constraints.md).
export function estimatedLineStarts(lines: NoteLine[]): LineTimings {
  const { lineSeconds, totalSeconds } = noteTiming(lines);
  let elapsed = 0;
  const lineStarts = lineSeconds.map((seconds) => {
    const start = elapsed;
    elapsed += seconds;
    return start;
  });
  return { lineStarts, durationSeconds: totalSeconds };
}

// Where a section starts, as a share of the whole: the scrubber's notches. The note's own
// first section starts at nothing, so it has no notch.
export function sectionStartFractions(lines: NoteLine[], timings: LineTimings): number[] {
  if (timings.durationSeconds <= 0) {
    return [];
  }
  return lines.flatMap((line, index) => {
    const start = timings.lineStarts[index] ?? 0;
    return line.heading && start > 0 ? [start / timings.durationSeconds] : [];
  });
}
