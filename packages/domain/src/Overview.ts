import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { VideoSource } from "./VideoSource.js";
import { CoreFields } from "./CoreFields.js";
import { Filing } from "./Filing.js";
import { Verdict } from "./Verdict.js";
import { Selling } from "./Selling.js";
import { HowToApply } from "./HowToApply.js";
import { WatchAnyway } from "./WatchAnyway.js";
import { Chapters } from "./Chapter.js";

// Read/favourite state is intentionally absent — docs/prototype/decisions.md: it lives
// in its own table, keyed by overview id, because this record can be replaced
// wholesale on a re-run.
export const Overview = z
  .object({
    id: OverviewId,
    video: VideoSource,
    savedAt: z.iso.datetime(),
    // Why the reader wanted this video overviewed, in their own words: asked for while the
    // overview is being made, and editable from its page after. Not a note taken against
    // the video, which is a separate future feature the word "note" is kept free for
    // (docs/architecture/v1-architecture-decisions.md, docs/features/capture-reason.md).
    captureReason: z.string().nullable(),
  })
  .extend(CoreFields.shape)
  .extend(Filing.shape)
  .extend({
    verdict: Verdict.nullable(),
    selling: Selling.nullable(),
    howToApply: HowToApply.nullable(),
    watchAnyway: WatchAnyway.nullable(),
    // Null for a record written before chapters existed; a list, possibly empty, for one
    // written since (docs/features/chapters.md).
    chapters: Chapters.nullable(),
  })
  .superRefine((overview, ctx) => {
    if (overview.thin && overview.verdict !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verdict"],
        message: "thin overviews never carry a verdict",
      });
    }
  });
export type Overview = z.infer<typeof Overview>;
