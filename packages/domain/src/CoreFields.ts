import { z } from "zod";
import { TimeRange } from "./WatchAnyway.js";
import { wordCount } from "./wordCount.js";

export const KeyPoint = z.object({
  text: z.string(),
  range: TimeRange.nullable(),
});
export type KeyPoint = z.infer<typeof KeyPoint>;

export const CoreFields = z.object({
  inOneLine: z
    .string()
    .refine((s) => wordCount(s) <= 25, "docs/features/overview-generation-decisions.md: max 25 words"),
  coreClaim: z
    .string()
    .refine((s) => wordCount(s) <= 60, "docs/features/overview-generation-decisions.md: max 60 words"),
  // Gates Verdict — see Overview.ts's cross-field check and docs/features/overview-generation-decisions.md.
  thin: z.boolean(),
  keyPoints: z.array(KeyPoint).min(3).max(7),
});
export type CoreFields = z.infer<typeof CoreFields>;
