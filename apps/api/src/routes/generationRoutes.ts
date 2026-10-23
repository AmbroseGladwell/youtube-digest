import type { FastifyInstance } from "fastify";
import { OurKeyGenerationRequest, type OurKeyGenerationStatus } from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import {
  OurKeyDailyCapSpentError,
  OurKeyGenerationError,
  OurKeyQuotaSpentError,
  OurKeyUnavailableError,
  type OurKeyGenerator,
} from "../generation/OurKeyGenerator.js";

// A two-hour transcript with a reader's whole library of topics, claims and tags.
const GENERATION_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

export function generationRoutes(
  app: FastifyInstance,
  { generator, sql }: { generator: OurKeyGenerator | null; sql: SqlClient },
): void {
  app.get("/generations", { config: { public: true } }, async () => {
    const status: OurKeyGenerationStatus = { available: generator !== null };
    return status;
  });

  app.post("/generations", { bodyLimit: GENERATION_BODY_LIMIT_BYTES }, async (request, reply) => {
    const body = parseOrThrow(OurKeyGenerationRequest, request.body, "The generation request");
    if (generator === null) {
      throw new ApiError("unavailable", "This server does not make overviews on its own key");
    }
    const { accountId } = request.session!;
    try {
      return await generator.generate({ accountId, plan: await accountPlan(sql, accountId) }, body, request.log);
    } catch (error) {
      if (error instanceof OurKeyQuotaSpentError) {
        reply.header("retry-after", String(error.retryAfterSeconds));
        throw new ApiError("too_many_requests", error.message, {
          quota: "ours",
          resetsOn: error.resetsOn,
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      if (error instanceof OurKeyDailyCapSpentError) {
        reply.header("retry-after", String(error.retryAfterSeconds));
        throw new ApiError("too_many_requests", error.message, {
          quota: "our-key-daily",
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      if (error instanceof OurKeyUnavailableError) {
        throw new ApiError("unavailable", "Overviews on our key aren't available right now");
      }
      if (error instanceof OurKeyGenerationError) {
        throw new ApiError("generation_failed", error.message, { fallback: error.fallback });
      }
      throw error;
    }
  });
}
