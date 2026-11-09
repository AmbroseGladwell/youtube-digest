import { wordCount } from "@overview/domain";
import { segmentRangeOf, type GeneratedOutput } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import type { CoverageInput } from "./measureCoverage.js";

export const videoCoverageInput = ({ transcript }: FetchedTranscript, output: GeneratedOutput): CoverageInput => ({
  unitWords: transcript.map(({ text }) => wordCount(text)),
  points: output.keyPoints.map((point) => {
    const range = segmentRangeOf(point);
    return range === null ? null : { start: range.startSegmentIndex, end: range.endSegmentIndex };
  }),
  chapterStarts: output.chapters.map(({ startSegmentIndex }) => startSegmentIndex),
});
