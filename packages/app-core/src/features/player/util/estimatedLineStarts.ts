import { noteTiming, type NoteLine } from "@overview/domain";

export interface LineTimings {
  lineStarts: number[];
  durationSeconds: number;
}

// Only ever shown with a ~, because nobody measured it: docs/features/audio-player.md, "The pacer".
export const estimatedLineStarts = (lines: NoteLine[]): LineTimings => {
  const { lineSeconds, totalSeconds } = noteTiming(lines);
  let elapsed = 0;
  const lineStarts = lineSeconds.map((seconds) => {
    const start = elapsed;
    elapsed += seconds;
    return start;
  });
  return { lineStarts, durationSeconds: totalSeconds };
};

export const sectionStartFractions = (lines: NoteLine[], timings: LineTimings): number[] => {
  if (timings.durationSeconds <= 0) {
    return [];
  }
  return lines.flatMap((line, index) => {
    const start = timings.lineStarts[index] ?? 0;
    return line.heading && start > 0 ? [start / timings.durationSeconds] : [];
  });
};
