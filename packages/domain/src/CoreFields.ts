import { z } from "zod";
import { Evidence } from "./Evidence.js";
import { TimeRange } from "./WatchAnyway.js";
import { wordCount } from "./wordCount.js";

export const KeyPoint = z.object({
  text: z.string(),
  range: TimeRange.nullable(),
  // Absent on a point with no quotation, and on every note before schema 17 (OV-216).
  evidence: Evidence.optional(),
});
export type KeyPoint = z.infer<typeof KeyPoint>;

// A long source's note can need ten; past that a list read aloud stops explaining and starts
// listing (docs/features/overview-generation-decisions.md, "One note budget").
export const MOST_KEY_POINTS = 10;

export const IN_ONE_LINE_TARGET_WORDS = 25;
export const IN_ONE_LINE_MAX_WORDS = 35;

export const CoreFields = z.object({
  inOneLine: z
    .string()
    .refine(
      (s) => wordCount(s) <= IN_ONE_LINE_MAX_WORDS,
      `docs/features/overview-generation-decisions.md: max ${IN_ONE_LINE_MAX_WORDS} words`,
    ),
  coreClaim: z.string().refine((s) => wordCount(s) <= 60, "docs/features/overview-generation-decisions.md: max 60 words"),
  // Gates Verdict — see Overview.ts's cross-field check and docs/features/overview-generation-decisions.md.
  thin: z.boolean(),
  keyPoints: z.array(KeyPoint).min(3).max(MOST_KEY_POINTS),
});
export type CoreFields = z.infer<typeof CoreFields>;
