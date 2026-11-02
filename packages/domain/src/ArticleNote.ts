import { z } from "zod";
import { ArticlePlace } from "./ArticlePlace.js";
import { Chapter } from "./Chapter.js";
import { CoreFields } from "./CoreFields.js";
import { Filing } from "./Filing.js";
import { HowToApply } from "./HowToApply.js";
import { Selling } from "./Selling.js";
import { DubiousClaim, Novelty, SimilarOverview, Verdict } from "./Verdict.js";
import { WatchAnswer, WatchAnyway } from "./WatchAnyway.js";
import { wordCount } from "./wordCount.js";

export const ArticleChapter = z.object({
  title: Chapter.shape.title,
  summary: Chapter.shape.summary,
  place: ArticlePlace,
});
export type ArticleChapter = z.infer<typeof ArticleChapter>;

export const ArticleSectionLink = z.object({ title: z.string().min(1), place: ArticlePlace });
export type ArticleSectionLink = z.infer<typeof ArticleSectionLink>;

export const ReadAnyway = z
  .object({
    answer: WatchAnswer,
    reason: WatchAnyway.shape.reason,
    // What the note doesn't carry, named, so the reader can judge that for themselves
    // (docs/features/article-notes.md).
    leftOut: z.string().refine((s) => wordCount(s) <= 30, "docs/features/article-notes.md: max 30 words"),
    sections: z.array(ArticleSectionLink),
  })
  .refine((read) => read.answer !== "partial" || read.sections.length > 0, {
    path: ["sections"],
    message: "a partial answer names the sections",
  });
export type ReadAnyway = z.infer<typeof ReadAnyway>;

export const ArticleVerdict = z.object({
  novelty: Novelty,
  standsOut: z.object({ text: z.string(), place: ArticlePlace.nullable() }).nullable(),
  dubious: Verdict.shape.dubious,
  dubiousClaims: z.array(DubiousClaim.omit({ startMs: true }).extend({ place: ArticlePlace.nullable() })),
  reasoning: Verdict.shape.reasoning,
  similarTo: z.array(SimilarOverview),
});
export type ArticleVerdict = z.infer<typeof ArticleVerdict>;

// What generation makes of an article. It parallels Overview rather than joining it
// (docs/features/article-notes.md).
export const ArticleNote = z.object({
  inOneLine: CoreFields.shape.inOneLine,
  coreClaim: CoreFields.shape.coreClaim,
  thin: CoreFields.shape.thin,
  keyPoints: z.array(z.object({ text: z.string(), place: ArticlePlace.nullable() })).min(3).max(7),
  chapters: z.array(ArticleChapter),
  topicIds: Filing.shape.topicIds,
  tags: Filing.shape.tags,
  verdict: ArticleVerdict.nullable(),
  selling: Selling.nullable(),
  howToApply: HowToApply.nullable(),
  readAnyway: ReadAnyway.nullable(),
});
export type ArticleNote = z.infer<typeof ArticleNote>;
