import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { ArticleDetails } from "./ArticleDetails.js";
import { Source } from "./Source.js";
import { BigPicture } from "./BigPicture.js";
import { CoreFields, KeyPoint, MOST_KEY_POINTS } from "./CoreFields.js";
import { RecipeNote } from "./RecipeNote.js";
import { Filing } from "./Filing.js";
import { Verdict } from "./Verdict.js";
import { Selling } from "./Selling.js";
import { HowToApply } from "./HowToApply.js";
import { WatchAnyway } from "./WatchAnyway.js";
import { Chapters } from "./Chapter.js";
import { MadeOn } from "./MadeOn.js";
import { PlaylistOrigin } from "./PlaylistOrigin.js";

export const recipeShape = (
  note: { recipe?: RecipeNote | null | undefined; keyPoints: KeyPoint[]; verdict: unknown; article?: unknown },
  ctx: z.RefinementCtx,
) => {
  if (note.recipe == null) {
    if (note.keyPoints.length < 3) {
      ctx.addIssue({ code: "custom", path: ["keyPoints"], message: "a note has at least 3 key points" });
    }
    return;
  }
  if (note.keyPoints.length > 0 || note.verdict !== null || note.article != null) {
    ctx.addIssue({ code: "custom", path: ["recipe"], message: "a recipe's note is its summary and recipe alone" });
  }
};

// Read/favourite state is intentionally absent — docs/prototype/decisions.md: it lives
// in its own table, keyed by overview id, because this record can be replaced
// wholesale on a re-run.
export const Overview = z
  .object({
    id: OverviewId,
    source: Source,
    savedAt: z.iso.datetime(),
    // Why the reader wanted this video overviewed, in their own words: asked for while the
    // overview is being made, and editable from its page after. Not a note taken against
    // the video, which is a separate future feature the word "note" is kept free for
    // (docs/architecture/v1-architecture-decisions.md, docs/features/capture-reason.md).
    captureReason: z.string().nullable(),
    // Null for an overview the reader asked for one video at a time (docs/features/playlists.md).
    fromPlaylist: PlaylistOrigin.nullable(),
    // Null for an overview made before keys were recorded, and for one saved from a share
    // (docs/architecture/tiers.md, "Which key an overview uses").
    madeOn: MadeOn.nullable(),
    // Saved from one of Start's samples, so it isn't the reader's first overview of their own.
    // Absent on everything else (docs/features/onboarding.md, "Try a sample").
    fromSample: z.literal(true).optional(),
  })
  .extend(CoreFields.shape)
  .extend(Filing.shape)
  .extend({
    // Null when the source earned none, and on a record written before it existed
    // (docs/features/overview-generation-decisions.md, "The big picture").
    bigPicture: BigPicture.nullable(),
    verdict: Verdict.nullable(),
    selling: Selling.nullable(),
    howToApply: HowToApply.nullable(),
    watchAnyway: WatchAnyway.nullable(),
    // Null for a record written before chapters existed; a list, possibly empty, for one
    // written since (docs/features/chapters.md).
    chapters: Chapters.nullable(),
    // Null for a video (docs/features/article-notes.md).
    article: ArticleDetails.nullable(),
    // Null for anything but a recipe page, whose note is this in place of the argument-shaped
    // fields, which stay empty (docs/features/recipe-notes.md).
    recipe: RecipeNote.nullable(),
    keyPoints: z.array(KeyPoint).max(MOST_KEY_POINTS),
  })
  .superRefine((overview, ctx) => {
    recipeShape(overview, ctx);
    if (overview.thin && overview.verdict !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verdict"],
        message: "thin overviews never carry a verdict",
      });
    }
  });
export type Overview = z.infer<typeof Overview>;
