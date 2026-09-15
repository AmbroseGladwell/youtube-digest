import { z } from "zod";
import { VideoSource, CoreFields } from "./core.js";
import { Filing } from "./filing.js";
import { Verdict } from "./verdict.js";
import { Selling } from "./selling.js";
import { HowToApply } from "./how-to-apply.js";
import { WatchAnyway } from "./watch-anyway.js";

// Read/favourite state is intentionally absent — docs/decisions.md: it lives in its
// own table, keyed by note id, because this record can be replaced wholesale on a
// re-run.
export const Note = z
  .object({
    id: z.string(),
    video: VideoSource,
    savedAt: z.string().datetime(),
    savedNote: z.string().nullable(),
  })
  .merge(CoreFields)
  .merge(Filing)
  .extend({
    verdict: Verdict.nullable(),
    selling: Selling.nullable(),
    howToApply: HowToApply.nullable(),
    watchAnyway: WatchAnyway.nullable(),
  })
  .superRefine((note, ctx) => {
    if (note.thin && note.verdict !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verdict"],
        message: "thin notes never carry a verdict",
      });
    }
  });
export type Note = z.infer<typeof Note>;
