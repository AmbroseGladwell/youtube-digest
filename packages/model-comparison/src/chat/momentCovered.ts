import type { Passage } from "./transcriptPassages.js";

export const MOMENT_TOLERANCE_MS = 10_000;

export const momentCovered = (passages: readonly Passage[], momentMs: number): boolean =>
  passages.some((passage) => passage.startMs - MOMENT_TOLERANCE_MS <= momentMs && momentMs <= passage.endMs + MOMENT_TOLERANCE_MS);

export const everyMomentCovered = (passages: readonly Passage[], momentsMs: readonly number[]): boolean =>
  momentsMs.length > 0 && momentsMs.every((momentMs) => momentCovered(passages, momentMs));
