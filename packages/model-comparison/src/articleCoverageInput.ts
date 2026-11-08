import { wordCount, type ExtractedArticle } from "@overview/domain";
import { articleParagraphs, type GeneratedArticleOutput } from "@overview/generation";
import type { CoverageInput } from "./measureCoverage.js";

export const articleCoverageInput = (article: ExtractedArticle, output: GeneratedArticleOutput): CoverageInput => ({
  unitWords: articleParagraphs(article).map(({ text }) => wordCount(text)),
  points: output.keyPoints.map(({ paragraphIndex }) => (paragraphIndex === null ? null : { start: paragraphIndex, end: paragraphIndex })),
  chapterStarts: output.chapters.map(({ startParagraphIndex }) => startParagraphIndex),
});
