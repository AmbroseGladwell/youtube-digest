import type { NoteLine } from "@overview/domain";

// The note's line whose moment holds a cited time, to scroll to and tint (design 310n): the
// line whose stretch contains it, or else the latest one starting before it. Null when no line
// has a moment at or before it.
export function citedLineIndex(lines: readonly NoteLine[], startMs: number): number | null {
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
}
