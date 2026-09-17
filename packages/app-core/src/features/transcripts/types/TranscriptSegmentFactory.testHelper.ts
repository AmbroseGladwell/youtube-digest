import type { TranscriptSegment } from "@overview/types";

export const makeTranscriptSegment = (overrides: Partial<TranscriptSegment> = {}): TranscriptSegment => ({
  text: "A caption from the video.",
  startMs: 0,
  endMs: 3000,
  ...overrides,
});
