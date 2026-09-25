import { z } from "zod";
import { wordCount } from "./wordCount.js";

export const Chapter = z
  .object({
    title: z.string().refine((s) => wordCount(s) <= 8, "docs/features/chapters.md: max 8 words"),
    summary: z
      .string()
      .refine((s) => wordCount(s) <= 40, "docs/features/chapters.md: max 40 words"),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
  })
  .refine((chapter) => chapter.endMs >= chapter.startMs, {
    path: ["endMs"],
    message: "a chapter ends at or after it starts",
  });
export type Chapter = z.infer<typeof Chapter>;

export const Chapters = z.array(Chapter).superRefine((chapters, ctx) => {
  chapters.forEach((chapter, index) => {
    const previous = chapters[index - 1];
    if (previous !== undefined && chapter.startMs < previous.endMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "startMs"],
        message: "chapters run in order and do not overlap",
      });
    }
  });
});
export type Chapters = z.infer<typeof Chapters>;
