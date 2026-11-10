import { z } from "zod";
import type { GenerationInput } from "../GenerationInput.js";

export const NO_SEGMENT = -1;

export interface SegmentRangeShape {
  startSegmentIndex: number;
  endSegmentIndex: number;
}

// Two plain indexes, with -1 for no stretch, rather than a range object that may be null:
// every union in the schema grows the grammar Claude compiles from it, and the video schema
// outgrew Claude's limit with them (docs/features/overview-generation-decisions.md,
// "Segment ranges are two plain indexes").
export function segmentRangeFields(input: GenerationInput) {
  const index = input.transcript.length === 0 ? z.literal(NO_SEGMENT) : z.int().min(NO_SEGMENT);
  return { startSegmentIndex: index, endSegmentIndex: index };
}

export const segmentRangeOf = (item: SegmentRangeShape): SegmentRangeShape | null =>
  item.startSegmentIndex === NO_SEGMENT || item.endSegmentIndex === NO_SEGMENT
    ? null
    : { startSegmentIndex: item.startSegmentIndex, endSegmentIndex: item.endSegmentIndex };

export interface QuoteRangeShape {
  quoteStartSegmentIndex: number;
  quoteEndSegmentIndex: number;
}

// The segments a quotation is lifted from, by the same rules as a stretch: -1 for none.
export function quoteRangeFields(input: GenerationInput) {
  const { startSegmentIndex, endSegmentIndex } = segmentRangeFields(input);
  return { quoteStartSegmentIndex: startSegmentIndex, quoteEndSegmentIndex: endSegmentIndex };
}

export const quoteRangeOf = (item: QuoteRangeShape): SegmentRangeShape | null =>
  segmentRangeOf({ startSegmentIndex: item.quoteStartSegmentIndex, endSegmentIndex: item.quoteEndSegmentIndex });
