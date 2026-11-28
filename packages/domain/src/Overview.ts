import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { ArticleDetails } from "./ArticleDetails.js";
import { Source } from "./Source.js";
import { BigPicture } from "./BigPicture.js";
import { FollowUpQuestions } from "./FollowUpQuestions.js";
import { CoreFields, KeyPoint, MOST_KEY_POINTS } from "./CoreFields.js";
import { RecipeNote } from "./RecipeNote.js";
import { Filing } from "./Filing.js";
import { Verdict } from "./Verdict.js";
import { Selling } from "./Selling.js";
import { HowToApply } from "./HowToApply.js";
import { SourceSteps } from "./SourceSteps.js";
import { WatchAnyway } from "./WatchAnyway.js";
import { Chapters } from "./Chapter.js";
import { MadeOn } from "./MadeOn.js";
import { FeedOrigin } from "./FeedOrigin.js";
import { PlaylistOrigin } from "./PlaylistOrigin.js";

export interface RecipeShapeNote {
  recipe?: RecipeNote | null | undefined;
  keyPoints: KeyPoint[];
  verdict: unknown;
  article?: unknown;
}

export const recipeShape = (note: RecipeShapeNote, ctx: z.RefinementCtx) => {
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

// No read or favourite state, so a re-run can replace it wholesale (docs/prototype/decisions.md).
export const Overview = z
  .object({
    id: OverviewId,
    source: Source,
    savedAt: z.iso.datetime(),
    // The reader's own why, not a note on the video (docs/features/capture-reason.md).
    captureReason: z.string().nullable(),
    // Null for an overview the reader asked for one video at a time (docs/features/playlists.md).
    fromPlaylist: PlaylistOrigin.nullable(),
    // The feed a followed entry came from: docs/features/followed-feeds.md, "Making an entry".
    fromFeed: FeedOrigin.nullish().catch(null),
    // Null before keys were recorded, and when saved from a share (docs/architecture/tiers.md).
    madeOn: MadeOn.nullable(),
    // From one of Start's samples, so not the reader's first: docs/features/onboarding.md, "Try a sample".
    fromSample: z.literal(true).optional(),
    // The reader's last topic, tag or why edit, never the app's: docs/features/library-sort.md, "Updated".
    editedAt: z.iso.datetime().optional(),
  })
  .extend(CoreFields.shape)
  .extend(Filing.shape)
  .extend({
    // Null when unearned or older: docs/features/overview-generation-decisions.md, "The big picture".
    bigPicture: BigPicture.nullable(),
    verdict: Verdict.nullable(),
    selling: Selling.nullable(),
    // Null with no process to follow, for a recipe, and on older records (docs/features/source-steps.md).
    sourceSteps: SourceSteps.nullable(),
    howToApply: HowToApply.nullable(),
    watchAnyway: WatchAnyway.nullable(),
    // Null on records from before chapters (docs/features/chapters.md).
    chapters: Chapters.nullable(),
    // Null for a video (docs/features/article-notes.md).
    article: ArticleDetails.nullable(),
    // Only a recipe page's, in place of the argument fields (docs/features/recipe-notes.md).
    recipe: RecipeNote.nullable(),
    keyPoints: z.array(KeyPoint).max(MOST_KEY_POINTS),
    // Null on older records; up to nine, best first (docs/features/follow-up-questions.md).
    followUpQuestions: FollowUpQuestions.nullable(),
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
