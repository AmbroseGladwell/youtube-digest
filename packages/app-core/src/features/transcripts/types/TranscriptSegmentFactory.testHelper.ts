import type { TranscriptSegment } from "@overview/domain";

export const makeTranscriptSegment = (
  overrides: Partial<TranscriptSegment> = {},
): TranscriptSegment => ({
  text: "A caption from the video.",
  startMs: 0,
  endMs: 3000,
  ...overrides,
});

// A run of back-to-back captions of the length YouTube actually emits. Every test that
// exercises the merging, the search or the following needs one, and they only differ in
// where the run starts and how long each cue is.
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
