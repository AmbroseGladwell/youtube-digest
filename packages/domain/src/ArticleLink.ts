import { z } from "zod";

export const MOST_RESOURCES = 5;

// A link out of an article, named by its own words on the page, and only ever https
// (docs/features/article-resources.md).
export const ArticleLink = z.object({
  text: z.string().min(1),
  href: z.url({ protocol: /^https$/ }),
});
export type ArticleLink = z.infer<typeof ArticleLink>;
