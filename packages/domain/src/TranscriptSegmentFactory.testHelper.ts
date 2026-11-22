import type { TranscriptSegment } from "./TranscriptSegment.js";

export const makeTranscriptSegment = (overrides: Partial<TranscriptSegment> = {}): TranscriptSegment => ({
  text: "A caption from the video.",
  startMs: 0,
  endMs: 3000,
  ...overrides,
});

// Cues of the length YouTube actually emits.
export const makeCaptionRun = (
  texts: string[],
  { startMs = 0, cueMs = 3000 }: { startMs?: number; cueMs?: number } = {},
): TranscriptSegment[] =>
  texts.map((text, index) =>
    makeTranscriptSegment({
      text,
      startMs: startMs + index * cueMs,
      endMs: startMs + (index + 1) * cueMs,
    }),
  );
