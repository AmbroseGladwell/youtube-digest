import type { NoteLine } from "@overview/domain";

export const citedLineIndex = (lines: readonly NoteLine[], startMs: number): number | null => {
  let latest: number | null = null;
  for (const [index, line] of lines.entries()) {
    const range = line.range;
    if (range === undefined || line.heading) {
      continue;
    }
    if (range.startMs <= startMs && startMs < range.endMs) {
      return index;
    }
    if (range.startMs <= startMs && (latest === null || range.startMs >= (lines[latest]!.range?.startMs ?? 0))) {
      latest = index;
    }
  }
  return latest;
};
