import { z } from "zod";
import { WatchAnyway } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const SegmentRangeShape = z.object({
  startSegmentIndex: z.int().nonnegative(),
  endSegmentIndex: z.int().nonnegative(),
});
export type SegmentRangeShape = z.infer<typeof SegmentRangeShape>;

export const watchAnywaySection: PromptSection = {
  title: "Watch it anyway",
  key: "watchAnyway",
  prompt: () => `
## Watch it anyway?
Yes, no, or partial, plus a reason. Default to no. Say yes only if the
visual or the sound IS the claim: a physical technique I'd perform wrong
from a written description, a demonstration whose outcome is the
evidence, or a visual or a sound that carries information the words do
not. It is not enough that the video has visuals, or that seeing it would
be nicer. If a competent written description would get me to the same
place, the answer is no. Assume I am trying to stop watching these, and
that a soft yes costs me ten minutes I will not get back.

Say partial when this is true of only part of the video. When you do,
name the range as startSegmentIndex/endSegmentIndex, taken from the
numbered transcript segments below — pick the segment numbers that bound
the part worth watching, don't estimate a time.`,
  schemaShape: (input) => ({
    answer: WatchAnyway.shape.answer,
    reason: WatchAnyway.shape.reason,
    range:
      input.transcript.length === 0
        ? z.null()
        : SegmentRangeShape.nullable(),
  }),
};
