import { useEffect, useMemo, useState } from "react";
import type { NoteLine } from "../types/NoteLine.js";
import { formatClock } from "../util/formatClock.js";
import { elapsedSecondsBefore, noteTiming } from "../util/noteTiming.js";

const RATES = [1, 1.25, 1.5, 2];

export interface ReadAlong {
  activeIndex: number;
  playing: boolean;
  rateLabel: string;
  elapsed: string;
  total: string;
  progressPercent: number;
  currentSection: string;
  selectLine: (index: number) => void;
  selectSection: (section: string) => void;
  step: (delta: number) => void;
  togglePlaying: () => void;
  cycleRate: () => void;
}

// There is no narrated audio (docs/features/tts-pre-rendered-speech.md was designed and
// not built), so this paces the reading mark through the note itself: each line is held
// for as long as it would take to say, divided by the chosen rate.
export function useReadAlong(lines: NoteLine[]): ReadAlong {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);

  const timing = useMemo(() => noteTiming(lines), [lines]);
  const rate = RATES[rateIndex]!;

  useEffect(() => {
    setActiveIndex(0);
    setPlaying(false);
  }, [lines]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    if (activeIndex >= lines.length - 1) {
      setPlaying(false);
      return;
    }
    const holdMs = ((timing.lineSeconds[activeIndex] ?? 0) * 1000) / rate;
    const timer = setTimeout(() => setActiveIndex(activeIndex + 1), holdMs);
    return () => clearTimeout(timer);
  }, [playing, activeIndex, rate, timing, lines.length]);

  const clamp = (index: number) => Math.min(Math.max(index, 0), Math.max(lines.length - 1, 0));

  return {
    activeIndex,
    playing,
    rateLabel: `${rate}x`,
    elapsed: formatClock(elapsedSecondsBefore(timing, activeIndex)),
    total: formatClock(timing.totalSeconds),
    progressPercent:
      lines.length === 0 ? 0 : Math.round(((activeIndex + 1) / lines.length) * 100),
    currentSection: lines[activeIndex]?.section ?? "",
    selectLine: (index) => setActiveIndex(clamp(index)),
    selectSection: (section) => {
      const index = lines.findIndex((line) => line.section === section);
      if (index !== -1) {
        setActiveIndex(index);
      }
    },
    step: (delta) => setActiveIndex(clamp(activeIndex + delta)),
    togglePlaying: () => setPlaying(!playing),
    cycleRate: () => setRateIndex((rateIndex + 1) % RATES.length),
  };
}
