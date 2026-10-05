import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { VideoId, type ServiceTranscriptStatus } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { QuotaSpentError, type ServiceCaller, type ServiceTranscripts } from "../transcripts/ServiceTranscripts.js";

const Params = z.object({ videoId: VideoId });

export function serviceTranscriptRoutes(
  app: FastifyInstance,
  { service, sql, clock }: { service: ServiceTranscripts | null; sql: SqlClient; clock: () => Date },
): void {
  app.get("/service-transcripts", { config: { public: true } }, async () => {
    const status: ServiceTranscriptStatus = { available: service !== null };
    return status;
  });

  app.post(
    "/service-transcripts/:videoId",
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.serviceTranscriptPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply) => {
      const { videoId } = parseOrThrow(Params, request.params, "The video id");
      if (service === null) {
        throw new ApiError("unavailable", "This server does not fetch transcripts itself");
      }
      const caller: ServiceCaller =
        request.session === null
          ? { address: request.clientAddress }
          : { accountId: request.session.accountId, plan: await accountPlan(sql, request.session.accountId) };
      try {
        const answer = await service.resolve(videoId, caller, request.log);
        if (answer.via === "cache") request.log.info("service transcript answered from the shared cache");
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
}
