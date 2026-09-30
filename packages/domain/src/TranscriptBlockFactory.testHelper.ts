import type { TranscriptBlock } from "./TranscriptBlock.js";

export const makeTranscriptBlock = (overrides: Partial<TranscriptBlock> = {}): TranscriptBlock => ({
  text: "A paragraph of the transcript, merged from several captions.",
  startMs: 0,
  endMs: 10_000,
  speakerChange: false,
  ...overrides,
});
