import { z } from "zod";
import { ExtractedArticle } from "./ExtractedArticle.js";

export const ArticleReadFailure = z.enum([
  "nothing-readable",
  "paywalled",
  "no-access",
  "not-loaded",
  "declined",
  "blocked",
  "not-found",
  "no-answer",
  "unfinished",
]);
export type ArticleReadFailure = z.infer<typeof ArticleReadFailure>;

export const ArticleRead = z.discriminatedUnion("status", [
  z.object({ status: z.literal("read"), article: ExtractedArticle }),
  z.object({
    status: z.literal("failed"),
    reason: ArticleReadFailure,
    // What a paywall let through, counted by us, so the reader is told it (design 77aj).
    shownWords: z.number().int().nonnegative().nullish(),
    siteName: z.string().nullish(),
  }),
]);
export type ArticleRead = z.infer<typeof ArticleRead>;
