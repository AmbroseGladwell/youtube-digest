import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, type ArticleRead } from "@overview/domain";
import { fetchedArticle } from "../articles/fetchedArticle.js";
import type { FetchedPage } from "../articles/fetchArticlePage.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";

const Body = z.object({ url: z.url() });

// Accounts only, and never the link in a log: what someone reads is theirs. The text goes back
// to the device and isn't kept (docs/features/pasted-article-links.md).
export function articleRoutes(
  app: FastifyInstance,
  { fetchPage, clock }: { fetchPage: (url: string) => Promise<FetchedPage>; clock: () => Date },
): void {
  app.post(
    "/articles/read",
    { preHandler: rateLimitHook(rateLimits.articleReadPerAddress, (request) => request.clientAddress, clock) },
    async (request): Promise<ArticleRead> => {
      const { url } = parseOrThrow(Body, request.body, "The article link");
      const startedAt = clock().getTime();
      const read = await fetchedArticle(await fetchPage(url));
      request.log.info(
        apiLogLines.articles.read({
          outcome: read.status === "read" ? "read" : read.reason,
          words: read.status === "read" ? read.article.wordCount : null,
          ms: clock().getTime() - startedAt,
        }),
      );
      return read;
    },
  );
}
