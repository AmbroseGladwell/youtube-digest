import { z } from "zod";
import { TimeRange } from "./WatchAnyway.js";
import { wordCount } from "./wordCount.js";

export const SOURCE_STEP_TARGET_WORDS = 30;
export const SOURCE_STEP_MAX_WORDS = 45;
// Completeness is the point, so this stops only a runaway list, never a real protocol
// (docs/features/source-steps.md).
export const MOST_SOURCE_STEPS = 25;
export const SOURCE_STEP_REASON_TARGET_WORDS = 25;
export const SOURCE_STEP_REASON_MAX_WORDS = 40;

export const SourceStep = z.object({
  text: z
    .string()
    .min(1)
    .refine((text) => wordCount(text) <= SOURCE_STEP_MAX_WORDS, `max ${SOURCE_STEP_MAX_WORDS} words`),
  range: TimeRange.nullable(),
  // A shaky step stays, since leaving it out would be a quiet omission, and says why. A step is
  // dubious only with a reason: a flag that can't say why only confuses.
  dubiousReason: z
    .string()
    .min(1)
    .refine((reason) => wordCount(reason) <= SOURCE_STEP_REASON_MAX_WORDS, `max ${SOURCE_STEP_REASON_MAX_WORDS} words`)
    .nullable(),
});
export type SourceStep = z.infer<typeof SourceStep>;

// The process the source itself gives, in its order and with nothing added. How to apply is
// the reader's own application, and may go beyond the source (docs/features/source-steps.md).
export const SourceSteps = z.object({
  items: z.array(SourceStep).min(1).max(MOST_SOURCE_STEPS),
});
export type SourceSteps = z.infer<typeof SourceSteps>;
