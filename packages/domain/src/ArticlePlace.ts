import { z } from "zod";

// Where in an article something is, resolved by code from a numbered paragraph. The anchor
// is a heading's id, for a place that starts at a heading; the quote is the paragraph's
// opening words, for a text fragment (docs/features/article-notes.md).
export const ArticlePlace = z.object({
  anchor: z.string().nullable(),
  quote: z.string().min(1),
});
export type ArticlePlace = z.infer<typeof ArticlePlace>;

const encodeFragmentText = (text: string): string =>
  encodeURIComponent(text).replace(/-/g, "%2D");

export const articlePlaceUrl = (url: string, { anchor, quote }: ArticlePlace): string =>
  anchor === null ? `${url}#:~:text=${encodeFragmentText(quote)}` : `${url}#${encodeURIComponent(anchor)}`;
