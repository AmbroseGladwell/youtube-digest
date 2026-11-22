import { z } from "zod";
import { ArticlePlace } from "./ArticlePlace.js";
import { wordCount } from "./wordCount.js";

export const MOST_RESOURCES = 5;
export const RESOURCE_WHY_TARGET_WORDS = 20;
export const RESOURCE_WHY_MOST_WORDS = 25;

// Named by its own words on the page, and only ever https (docs/features/article-resources.md).
export const ArticleLink = z.object({
  text: z.string().min(1),
  href: z.url({ protocol: /^https$/ }),
});
export type ArticleLink = z.infer<typeof ArticleLink>;

// Its paragraph, so the model sees the link beside the words that introduce it.
export const PageLink = ArticleLink.extend({
  paragraph: z.int().nonnegative(),
});
export type PageLink = z.infer<typeof PageLink>;

export const ArticleResource = ArticleLink.extend({
  why: z
    .string()
    .min(1)
    .refine((s) => wordCount(s) <= RESOURCE_WHY_MOST_WORDS, `docs/features/article-resources.md: max ${RESOURCE_WHY_MOST_WORDS} words`),
  place: ArticlePlace,
  chapter: z.int().nonnegative(),
});
export type ArticleResource = z.infer<typeof ArticleResource>;
