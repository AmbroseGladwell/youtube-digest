import { z } from "zod";
import { ExtractedArticle } from "./ExtractedArticle.js";

export const ArticleReadFailure = z.enum(["nothing-readable", "paywalled", "no-access"]);
export type ArticleReadFailure = z.infer<typeof ArticleReadFailure>;

export const ArticleRead = z.discriminatedUnion("status", [
  z.object({ status: z.literal("read"), article: ExtractedArticle }),
  z.object({ status: z.literal("failed"), reason: ArticleReadFailure }),
]);
export type ArticleRead = z.infer<typeof ArticleRead>;
