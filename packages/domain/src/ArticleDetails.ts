import { z } from "zod";
import { ArticlePlace } from "./ArticlePlace.js";
import { ArticleResource, MOST_RESOURCES } from "./ArticleLink.js";
import { Chapter } from "./Chapter.js";
import { WatchAnswer, WatchAnyway } from "./WatchAnyway.js";
import { wordCount } from "./wordCount.js";

export const ArticleChapter = z.object({
  title: Chapter.shape.title,
  summary: Chapter.shape.summary,
  place: ArticlePlace,
  // Measured, so each chapter's read time is arithmetic rather than a model's guess.
  wordCount: z.number().int().nonnegative(),
});
export type ArticleChapter = z.infer<typeof ArticleChapter>;

export const ReadAnyway = z
  .object({
    answer: WatchAnswer,
    reason: WatchAnyway.shape.reason,
    leftOut: z.string().refine((s) => wordCount(s) <= 30, "docs/features/article-notes.md: max 30 words"),
    chapterIndexes: z.array(z.int().nonnegative()).max(3),
  })
  .refine((read) => read.answer !== "partial" || read.chapterIndexes.length > 0, {
    path: ["chapterIndexes"],
    message: "a partial answer names the chapters",
  });
export type ReadAnyway = z.infer<typeof ReadAnyway>;

// An article's positions live here; a video's time fields stay null (docs/features/article-notes.md).
export const ArticleDetails = z
  .object({
    chapters: z.array(ArticleChapter).min(1),
    // One per key point: its chapter, or null where it spans several.
    keyPointChapters: z.array(z.int().nonnegative().nullable()),
    readAnyway: ReadAnyway.nullable(),
    // Absent rather than empty, so older share hashes hold (docs/features/article-resources.md).
    resources: z.array(ArticleResource).min(1).max(MOST_RESOURCES).optional(),
  })
  .refine((article) => (article.resources ?? []).every(({ chapter }) => chapter < article.chapters.length), {
    path: ["resources"],
    message: "a resource names one of the note's chapters",
  });
export type ArticleDetails = z.infer<typeof ArticleDetails>;
