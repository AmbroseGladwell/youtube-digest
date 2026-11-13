import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, type ArticleRead } from "@overview/domain";
import { fetchedArticle } from "../articles/fetchedArticle.js";
import type { FetchedPage } from "../articles/fetchArticlePage.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { reserveTrialRead } from "../usage/reserveTrialRead.js";

const Body = z.object({ url: z.url() });

// An account, or signed out a trial token reading onboarding's link, and never the link in a
// log: what someone reads is theirs. The text goes back to the device and isn't kept
// (docs/features/pasted-article-links.md).
export function articleRoutes(
  app: FastifyInstance,
  { fetchPage, trials, clock }: { fetchPage: (url: string) => Promise<FetchedPage>; trials: TrialsRepository; clock: () => Date },
): void {
  app.post(
    "/articles/read",
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.articleReadPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<ArticleRead> => {
      const { url } = parseOrThrow(Body, request.body, "The article link");
      await reserveTrialRead(request, reply, { trials, clock });
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
