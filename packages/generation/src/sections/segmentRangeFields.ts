import { z } from "zod";
import type { GenerationInput } from "../GenerationInput.js";

export const NO_SEGMENT = -1;

export interface SegmentRangeShape {
  startSegmentIndex: number;
  endSegmentIndex: number;
}

// Two plain indexes: docs/features/overview-generation-decisions.md, "The schema has to fit Claude's grammar".
export const segmentRangeFields = (input: GenerationInput) => {
  const index = input.transcript.length === 0 ? z.literal(NO_SEGMENT) : z.int().min(NO_SEGMENT);
  return { startSegmentIndex: index, endSegmentIndex: index };
};

export const segmentRangeOf = (item: SegmentRangeShape): SegmentRangeShape | null =>
  item.startSegmentIndex === NO_SEGMENT || item.endSegmentIndex === NO_SEGMENT
    ? null
    : { startSegmentIndex: item.startSegmentIndex, endSegmentIndex: item.endSegmentIndex };
