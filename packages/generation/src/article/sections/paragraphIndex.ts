import { z } from "zod";
import { articleParagraphs, articleSentences } from "../articleParagraphs.js";
import type { ArticleGenerationInput } from "../ArticleGenerationInput.js";

export const paragraphIndex = (input: ArticleGenerationInput) =>
  z
    .int()
    .min(0)
    .max(articleParagraphs(input.article).length - 1);

// A quotation's sentences, numbered across the article, with -1 for none (OV-216).
export const quoteSentenceFields = (input: ArticleGenerationInput) => {
  const index = z
    .int()
    .min(-1)
    .max(articleSentences(input.article).length - 1);
  return { quoteStartSentence: index, quoteEndSentence: index };
};
