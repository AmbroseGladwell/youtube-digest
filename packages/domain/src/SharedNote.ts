import { z } from "zod";
import { ArticleDetails } from "./ArticleDetails.js";
import { OverviewId } from "./Brands.js";
import { Chapters } from "./Chapter.js";
import { BigPicture } from "./BigPicture.js";
import { CoreFields, KeyPoint, MOST_KEY_POINTS } from "./CoreFields.js";
import { recipeShape } from "./Overview.js";
import { RecipeNote } from "./RecipeNote.js";
import { Filing } from "./Filing.js";
import { HowToApply } from "./HowToApply.js";
import { Selling } from "./Selling.js";
import { Source } from "./Source.js";
import { SourceSteps } from "./SourceSteps.js";
import { Verdict } from "./Verdict.js";
import { WatchAnyway } from "./WatchAnyway.js";

// Spelled out, not derived, so a new Overview field is shared only on purpose (docs/features/sharing.md).
export const SharedNote = z
  .object({
    id: OverviewId,
    source: Source,
    savedAt: z.iso.datetime(),
  })
  .extend(CoreFields.shape)
  .extend({ tags: Filing.shape.tags })
  .extend({
    // Absent rather than null when there is none, so a copy's content hash doesn't move.
    bigPicture: BigPicture.nullish(),
    verdict: Verdict.nullable(),
    selling: Selling.nullable(),
    // Absent rather than null when the source gives no steps, for the same reason.
    sourceSteps: SourceSteps.nullish(),
    howToApply: HowToApply.nullable(),
    watchAnyway: WatchAnyway.nullable(),
    chapters: Chapters.nullable(),
    // Absent on a video, so a copy's hash doesn't move: docs/features/source-identity.md, "Shares".
    article: ArticleDetails.nullish(),
    // Absent unless a recipe, for the same reason: docs/features/recipe-notes.md, "Sharing".
    recipe: RecipeNote.nullish(),
    keyPoints: z.array(KeyPoint).max(MOST_KEY_POINTS),
  })
  .superRefine(recipeShape);
export type SharedNote = z.infer<typeof SharedNote>;

export const SHARED_NOTE_FIELDS = Object.keys(SharedNote.shape).sort();

// docs/features/sharing.md, "What is in a shared copy, and what is not".
export const PRIVATE_OVERVIEW_FIELDS = [
  "captureReason",
  "topicIds",
  "fromPlaylist",
  "madeOn",
  "fromSample",
  "followUpQuestions",
  "editedAt",
] as const;
