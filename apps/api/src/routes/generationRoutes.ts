import type { FastifyInstance } from "fastify";
import { apiLogLines, OurKeyGenerationRequest, TRIAL_TOKEN_HEADER, TrialToken, type OurKeyGenerationStatus } from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import {
  OurKeyDailyCapSpentError,
  OurKeyGenerationError,
  OurKeyQuotaSpentError,
  OurKeyUnavailableError,
  TrialAddressSpentError,
  TrialSpentError,
  TrialUnknownError,
  type OurKeyCaller,
  type OurKeyGenerator,
} from "../generation/OurKeyGenerator.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";

// A two-hour transcript with a reader's whole library of topics, claims and tags.
const GENERATION_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

export function generationRoutes(
  app: FastifyInstance,
  {
    generator,
    trials,
    sql,
    clock,
  }: { generator: OurKeyGenerator | null; trials: TrialsRepository; sql: SqlClient; clock: () => Date },
): void {
  app.get("/generations", { config: { public: true } }, async () => {
    const status: OurKeyGenerationStatus = { available: generator !== null };
    return status;
  });

  // Signed out, a device asks for its trial token before its first overview on our key
  // (docs/architecture/tiers.md, "Counting").
  app.post(
    "/trials",
    {
      config: { public: true },
      preHandler: rateLimitHook(rateLimits.trialPerAddress, (request) => request.clientAddress, clock),
    },
    async (request) => {
      if (generator === null) {
        throw new ApiError("unavailable", "This server does not make overviews on its own key");
      }
      const trial: TrialToken = { token: await trials.issue(clock()) };
      request.log.info(apiLogLines.trials.issued());
      return trial;
    },
  );

  app.post("/generations", { bodyLimit: GENERATION_BODY_LIMIT_BYTES, config: { optionalSession: true } }, async (request, reply) => {
    const body = parseOrThrow(OurKeyGenerationRequest, request.body, "The generation request");
    const trialToken = request.headers[TRIAL_TOKEN_HEADER];
    if (request.session === null && typeof trialToken !== "string") {
      throw new ApiError("unauthenticated", "Sign in, or start a trial, to make an overview on our key");
    }
    if (generator === null) {
      throw new ApiError("unavailable", "This server does not make overviews on its own key");
    }
    const caller: OurKeyCaller =
      request.session === null
        ? { trialToken: trialToken as string, address: request.clientAddress }
        : { accountId: request.session.accountId, plan: await accountPlan(sql, request.session.accountId) };
    try {
      return await generator.generate(caller, body, request.log);
    } catch (error) {
      if (error instanceof TrialSpentError) {
        throw new ApiError("too_many_requests", error.message, { quota: "trial" });
      }
      if (error instanceof TrialAddressSpentError) {
        reply.header("retry-after", String(error.retryAfterSeconds));
        throw new ApiError("too_many_requests", error.message, {
          quota: "trial-address",
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      if (error instanceof TrialUnknownError) {
        throw new ApiError("unauthenticated", error.message, { trial: "unknown" });
      }
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
