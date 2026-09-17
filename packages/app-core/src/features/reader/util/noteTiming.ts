import type { NoteLine } from "../types/NoteLine.js";

// The two rates the reader's "4 min read · 6 min listen" line and its pacer are built
// from, and why they are arithmetic over the note's own words rather than an estimate
// anybody guessed: docs/features/overview-redesign.md, "Read and listen times".
const READING_WORDS_PER_MINUTE = 220;
const SPOKEN_WORDS_PER_MINUTE = 150;
const MINIMUM_LINE_SECONDS = 1.5;

export interface NoteTiming {
  lineSeconds: number[];
  totalSeconds: number;
  readMinutes: number;
  listenMinutes: number;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function noteTiming(lines: NoteLine[]): NoteTiming {
  const lineSeconds = lines.map((line) =>
    Math.max(MINIMUM_LINE_SECONDS, (countWords(line.text) / SPOKEN_WORDS_PER_MINUTE) * 60),
  );
  const words = lines.reduce((total, line) => total + countWords(line.text), 0);

  return {
    lineSeconds,
    totalSeconds: lineSeconds.reduce((total, seconds) => total + seconds, 0),
    readMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE)),
    listenMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / SPOKEN_WORDS_PER_MINUTE)),
  };
}

export function elapsedSecondsBefore(timing: NoteTiming, lineIndex: number): number {
  return timing.lineSeconds.slice(0, Math.max(0, lineIndex)).reduce((total, seconds) => total + seconds, 0);
}
