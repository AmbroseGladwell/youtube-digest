import { z } from "zod";
import { TimeRange } from "./WatchAnyway.js";
import { wordCount } from "./wordCount.js";

// A quotation is the source's own words, lifted by code from the stretch the model named,
// never written by a model (docs/architecture/overview-quality.md, "Evidence: the model
// points, code quotes"). Code cuts it to this many words.
export const EVIDENCE_MOST_WORDS = 40;

// What the quotation adds that the key point can't, said only when it does.
export const EVIDENCE_ADDS_TARGET_WORDS = 20;
export const EVIDENCE_ADDS_MAX_WORDS = 30;

export const Evidence = z.object({
  text: z.string().min(1),
  range: TimeRange,
  adds: z
    .string()
    .min(1)
    .refine((adds) => wordCount(adds) <= EVIDENCE_ADDS_MAX_WORDS, `max ${EVIDENCE_ADDS_MAX_WORDS} words`)
    .nullable(),
});
export type Evidence = z.infer<typeof Evidence>;
