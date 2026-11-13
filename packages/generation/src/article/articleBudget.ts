import type { ExtractedArticle } from "@overview/domain";
import { noteBudget, type NoteBudget } from "../noteBudget.js";

export const headedParts = (article: Pick<ExtractedArticle, "sections">): number =>
  article.sections.filter(({ heading }) => heading !== null).length;

export const articleBudget = (article: Pick<ExtractedArticle, "sections" | "wordCount">): NoteBudget =>
  noteBudget("written", article.wordCount, headedParts(article));
