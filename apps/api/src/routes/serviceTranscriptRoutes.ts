import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, VideoId, type ServiceTranscriptStatus } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { QuotaSpentError, type ServiceCaller, type ServiceTranscripts } from "../transcripts/ServiceTranscripts.js";
import type { CaptureSavesRepository } from "../usage/CaptureSavesRepository.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";
import { saveQuotas } from "../usage/saveQuotas.js";
import { secondsToNextUsageMonth } from "../usage/usageMonth.js";

const Params = z.object({ videoId: VideoId });

export interface ServiceTranscriptRoutesOptions {
  service: ServiceTranscripts | null;
  usage: OverviewUsageRepository;
  saves: CaptureSavesRepository;
  sql: SqlClient;
  clock: () => Date;
}

export const serviceTranscriptRoutes = (
  app: FastifyInstance,
  { service, usage, saves, sql, clock }: ServiceTranscriptRoutesOptions,
): void => {
  app.get("/service-transcripts", { config: { public: true } }, async () => {
    const status: ServiceTranscriptStatus = { available: service !== null };
    return status;
  });

  app.post(
    "/service-transcripts/:videoId",
    {
      preHandler: rateLimitHook(rateLimits.serviceTranscriptPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply) => {
      const { videoId } = parseOrThrow(Params, request.params, "The video id");
      if (service === null) {
        throw new ApiError("unavailable", "This server does not fetch transcripts itself");
      }
      // Why none left on either key refuses, unless a save without an overview is left: docs/features/kept-links.md.
      const { accountId } = request.session!;
      const caller: ServiceCaller = { accountId, plan: await accountPlan(sql, accountId) };
      const now = clock();
      const month = await usage.usage(now, caller.accountId, caller.plan);
      const overviewsSpent = month.ours.used >= month.ours.limit && month.own.used >= month.own.limit;
      const savesLeft = overviewsSpent ? saveQuotas[caller.plan] - (await saves.usedIn(now, accountId)) : 0;
      if (overviewsSpent && savesLeft > 0) {
        request.log.info(apiLogLines.serviceTranscripts.fetchedForSave({ savesLeft }));
      }
      if (overviewsSpent && savesLeft <= 0) {
        const retryAfterSeconds = secondsToNextUsageMonth(now);
        request.log.warn(apiLogLines.serviceTranscripts.overviewsSpent({ plan: caller.plan, resetsOn: month.resetsOn }));
        reply.header("retry-after", String(retryAfterSeconds));
        throw new ApiError("too_many_requests", "You've made this month's overviews", {
          quota: "overviews",
          resetsOn: month.resetsOn,
          retryAfterSeconds,
        });
      }
      try {
        const answer = await service.resolve(videoId, caller, request.log);
        return answer.transcript;
      } catch (error) {
        if (error instanceof QuotaSpentError) {
          reply.header("retry-after", String(error.retryAfterSeconds));
          throw new ApiError("too_many_requests", error.message, {
            retryAfterSeconds: error.retryAfterSeconds,
            daily: true,
          });
        }
        if (error instanceof TranscriptFetchError) {
          throw new ApiError("transcript_unavailable", error.message, { failure: error.failure });
        }
        throw error;
      }
    },
  );
};
