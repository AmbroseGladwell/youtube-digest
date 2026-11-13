import { z } from "zod";
import { Chapter } from "@overview/domain";
import { articleBudget } from "../articleBudget.js";
import { NEIGHBOURING_CHAPTERS_DIFFER } from "../../sections/chaptersSection.js";
import { articleParagraphs } from "../articleParagraphs.js";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";
import { paragraphIndex } from "./paragraphIndex.js";

export interface ArticleChapterShape {
  title: string;
  summary: string;
  startParagraphIndex: number;
}

const startsAtTheFirstParagraphAndAscends = (chapters: ArticleChapterShape[], ctx: z.RefinementCtx) => {
  chapters.forEach((chapter, index) => {
    const previous = chapters[index - 1];
    if (index === 0 && chapter.startParagraphIndex !== 0) {
      ctx.addIssue({ code: "custom", path: [0, "startParagraphIndex"], message: "the first chapter starts at paragraph 0" });
    }
    if (previous !== undefined && chapter.startParagraphIndex <= previous.startParagraphIndex) {
      ctx.addIssue({ code: "custom", path: [index, "startParagraphIndex"], message: "each chapter starts after the one before it" });
    }
  });
};

export const articleChaptersSection: ArticlePromptSection = {
  key: "structural",
  prompt: (input) => {
    const { mostChapters, long } = articleBudget(input.article);
    return `
## Chapters
Split the article into chapters at the points where its subject actually
changes: a new question, a new example, a new stage of the argument. Follow
the article's own headings where they mark such a change, and find the
changes yourself where it has none. A chapter is a stretch a reader would
skip to, not a paragraph. Use at most ${mostChapters} here, and a piece that does one
thing has one. Never split a stretch to make the list longer. Every part
of the article falls in a chapter, including its ending, and no chapter
should swallow most of it.${long ? NEIGHBOURING_CHAPTERS_DIFFER : ""}

For each chapter give a title of at most 8 plain words, and a summary of
one or two sentences (40 words at most) that says what that stretch
actually says: its finding, reason or number, not what it is about. A
reader who reads only the chapters should know how the argument goes.
Good: "A survey from 2011 was reused without an inspection, which is why
the estimate was half the real cost."
Bad: "Background on the survey and how the estimate was made."
Write them as sentences a person would say, in the same voice as the key
points, naming who says what: never a list of instructions or noun phrases.
Never repeat a key point in a chapter: use the chapters for what the key
points leave out. Quote nothing at length, and summarise rather than retell.

Name where each chapter begins as startParagraphIndex, taken from the
numbered paragraphs below. The first chapter starts at paragraph 0, and
each chapter starts after the one before it.`;
  },
  schemaShape: (input) => ({
    chapters: z
      .object({
        title: Chapter.shape.title,
        summary: Chapter.shape.summary,
        startParagraphIndex: paragraphIndex(input),
      })
      .array()
      .min(1)
      .max(Math.min(articleBudget(input.article).mostChapters, articleParagraphs(input.article).length))
      .superRefine(startsAtTheFirstParagraphAndAscends),
  }),
};
