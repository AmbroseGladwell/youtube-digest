import { z } from "zod";
import { wordCount } from "./wordCount.js";

export const BIG_PICTURE_MAX_WORDS = 160;

export const BigPicture = z
  .string()
  .refine(
    (s) => wordCount(s) <= BIG_PICTURE_MAX_WORDS,
    `docs/features/overview-generation-decisions.md: max ${BIG_PICTURE_MAX_WORDS} words`,
  );
export type BigPicture = z.infer<typeof BigPicture>;
