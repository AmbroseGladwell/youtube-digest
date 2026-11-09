import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, TRIAL_READS, TRIAL_READS_PER_ADDRESS_DAILY, TRIAL_TOKEN_HEADER, type ArticleRead } from "@overview/domain";
import { fetchedArticle } from "../articles/fetchedArticle.js";
import type { FetchedPage } from "../articles/fetchArticlePage.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { secondsToNextUsageDay } from "../transcripts/ServiceUsageRepository.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";

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
      if (request.session === null) {
        const trialToken = request.headers[TRIAL_TOKEN_HEADER];
        if (typeof trialToken !== "string") {
          throw new ApiError("unauthenticated", "Sign in, or start a trial, to read a link");
        }
        const now = clock();
        const reservation = await trials.reserveRead(now, trialToken, request.clientAddress);
        if (!reservation.reserved) {
          if (reservation.reason === "unknown") {
            throw new ApiError("unauthenticated", "This trial isn't known here", { trial: "unknown" });
          }
          if (reservation.reason === "spent") {
            request.log.warn(apiLogLines.articles.trialReadsSpent({ used: reservation.used, limit: TRIAL_READS }));
            throw new ApiError("too_many_requests", "You've read the links you can without an account", { quota: "trial-reads" });
          }
          const retryAfterSeconds = secondsToNextUsageDay(now);
          request.log.warn(apiLogLines.articles.trialReadAddressSpent({ used: reservation.used, limit: TRIAL_READS_PER_ADDRESS_DAILY }));
          reply.header("retry-after", String(retryAfterSeconds));
          throw new ApiError("too_many_requests", "Links read without an account are used up for today", {
            quota: "trial-reads-address",
            retryAfterSeconds,
          });
        }
      }
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
