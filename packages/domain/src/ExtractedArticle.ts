import { z } from "zod";
import { Recipe } from "./Recipe.js";

export const ArticleSection = z.object({
  // Null for the text before an article's first heading.
  heading: z.string().nullable(),
  // The heading's own id on the page, where it has one (docs/features/article-extraction.md).
  anchor: z.string().nullable(),
  text: z.string().min(1),
});
export type ArticleSection = z.infer<typeof ArticleSection>;

export const ExtractedArticle = z.object({
  url: z.url(),
  title: z.string().min(1),
  siteName: z.string().nullable(),
  author: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  language: z.string().nullable(),
  // The picture the page chose for when it is shared. Null where it has none, and never one
  // an https page could not show (docs/features/article-extraction.md).
  imageUrl: z.url().nullable(),
  sections: z.array(ArticleSection).min(1),
  wordCount: z.number().int().positive(),
  // Defaulted because a device that predates recipes still posts an article without one
  // (docs/features/recipe-notes.md).
  recipe: Recipe.nullable().default(null),
});
export type ExtractedArticle = z.infer<typeof ExtractedArticle>;
