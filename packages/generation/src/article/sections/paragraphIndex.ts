import { z } from "zod";
import { articleParagraphs } from "../articleParagraphs.js";
import type { ArticleGenerationInput } from "../ArticleGenerationInput.js";

export const paragraphIndex = (input: ArticleGenerationInput) =>
  z
    .int()
    .min(0)
    .max(articleParagraphs(input.article).length - 1);
