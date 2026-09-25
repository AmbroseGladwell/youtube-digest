import { z } from "zod";
import { Chapter } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export interface ChapterShape {
  title: string;
  summary: string;
  startSegmentIndex: number;
}

const startsAtTheFirstSegmentAndAscends = (chapters: ChapterShape[], ctx: z.RefinementCtx) => {
  chapters.forEach((chapter, index) => {
    const previous = chapters[index - 1];
    if (index === 0 && chapter.startSegmentIndex !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [0, "startSegmentIndex"],
        message: "the first chapter starts at segment 0",
      });
    }
    if (previous !== undefined && chapter.startSegmentIndex <= previous.startSegmentIndex) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "startSegmentIndex"],
        message: "each chapter starts after the one before it",
      });
    }
  });
};

export const chaptersSection: PromptSection = {
  title: "Chapters",
  key: "structural",
  prompt: () => `
## Chapters
Split the video into chapters at the points where its subject actually
changes: a new question, a new example, a new stage of the argument. A
chapter is a stretch a reader would skip to, not a paragraph. Most videos
have 3 to 8; a short video that does one thing has one. Never split a
stretch to make the list longer, and never merge two subjects to make it
shorter.

For each chapter give a title of at most 8 plain words, and a summary of
one or two sentences (40 words at most) on what that stretch covers, so
that reading the list down is a map of the video.

Name where each chapter begins as startSegmentIndex, taken from the
numbered transcript segments below. The first chapter starts at segment
0, and each chapter starts after the one before it. Never estimate a
time: the segment number is the position.`,
  schemaShape: (input) => {
    const lastIndex = input.transcript.length - 1;
    const chapterShape = z.object({
      title: Chapter.shape.title,
      summary: Chapter.shape.summary,
      startSegmentIndex: z.int().min(0).max(Math.max(lastIndex, 0)),
    });
    return {
      chapters:
        input.transcript.length === 0
          ? z.array(chapterShape).max(0)
          : z.array(chapterShape).min(1).superRefine(startsAtTheFirstSegmentAndAscends),
    };
  },
};
