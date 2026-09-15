import { z } from "zod";
import { VideoSource } from "./VideoSource.js";
import { CoreFields } from "./CoreFields.js";
import { Filing } from "./Filing.js";
import { Verdict } from "./Verdict.js";
import { Selling } from "./Selling.js";
import { HowToApply } from "./HowToApply.js";
import { WatchAnyway } from "./WatchAnyway.js";

// Read/favourite state is intentionally absent — docs/prototype/decisions.md: it lives in its
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
