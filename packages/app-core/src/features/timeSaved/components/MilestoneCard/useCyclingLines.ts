import { useEffect, useRef, useState } from "react";

export interface CyclingLine {
  index: number;
  previous: number | null;
  // 1 forward, -1 back, 0 for the line advancing on its own.
  direction: -1 | 0 | 1;
  // Bumped on every change, so a line shown twice in a row still replays its entrance.
  turn: number;
}

// Long enough to read the line at an easy pace, never so short it flickers or so long the
// card looks stuck (docs/features/time-saved.md, "The lines").
export const lineDurationMs = (line: string): number =>
  Math.min(13_000, Math.max(6_000, 3_000 + line.split(/\s+/).length * 330));

export function useCyclingLines(lines: readonly string[], paused: boolean) {
  const [line, setLine] = useState<CyclingLine>({ index: 0, previous: null, direction: 0, turn: 0 });
  const remaining = useRef(lineDurationMs(lines[0] ?? ""));
  const startedAt = useRef(0);

  const show = (index: number, direction: CyclingLine["direction"]) =>
    setLine((current) =>
      index === current.index
        ? current
        : { index, previous: current.index, direction, turn: current.turn + 1 },
    );

  useEffect(() => {
    remaining.current = lineDurationMs(lines[line.index] ?? "");
  }, [line, lines]);

  useEffect(() => {
    if (paused || lines.length < 2) {
      return;
    }
    startedAt.current = performance.now();
    const timer = setTimeout(() => show((line.index + 1) % lines.length, 0), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= performance.now() - startedAt.current;
    };
  }, [line, lines, paused]);

  return {
    line,
    durationMs: lineDurationMs(lines[line.index] ?? ""),
    step: (by: 1 | -1) => show((line.index + by + lines.length) % lines.length, by),
    jumpTo: (index: number) => show(index, index > line.index ? 1 : -1),
  };
}
