import type { FastifyInstance } from "fastify";
import {
  apiLogLines,
  ForAnyoneInput,
  OurKeyGenerationRequest,
  ProfilePassInput,
  TRIAL_TOKEN_HEADER,
  TopicMatchInput,
  TopicSuggestionInput,
  TrialToken,
  type ForAnyoneResult,
  type TopicMatchResult,
  type TopicSuggestionResult,
  type OurKeyGenerationStatus,
  type ProfilePassResult,
} from "@overview/domain";
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

  const smallPassLimit = rateLimitHook(rateLimits.smallPassPerAccount, (request) => request.session?.accountId ?? null, clock);
  const smallPass = async <Result>(run: (generator: OurKeyGenerator) => Promise<Result>): Promise<Result> => {
    if (generator === null) {
      throw new ApiError("unavailable", "This server does not make overviews on its own key");
    }
    try {
      return await run(generator);
    } catch (error) {
      if (error instanceof OurKeyGenerationError) {
        throw new ApiError("generation_failed", error.message, { fallback: error.fallback });
      }
      throw error;
    }
  };

  app.post("/generations/profile", { preHandler: smallPassLimit }, async (request) => {
    const input = parseOrThrow(ProfilePassInput, request.body, "The profile pass");
    const result: ProfilePassResult = { items: await smallPass((passes) => passes.profilePass(input, request.log)) };
    return result;
  });

  app.post("/generations/how-to-apply", { preHandler: smallPassLimit }, async (request) => {
    const input = parseOrThrow(ForAnyoneInput, request.body, "The How to apply pass");
    const result: ForAnyoneResult = { items: await smallPass((passes) => passes.forAnyone(input, request.log)) };
    return result;
  });

  app.post("/generations/topics", { preHandler: smallPassLimit }, async (request) => {
    const input = parseOrThrow(TopicMatchInput, request.body, "The topic pass");
    const result: TopicMatchResult = { names: await smallPass((passes) => passes.topics(input, request.log)) };
    return result;
  });

  // Signed out, onboarding's topics screen asks before there's an account, on the device's trial
  // and capped apart from its one overview (docs/features/onboarding.md, "Suggested topics").
  const trialTokenOf = (request: { headers: Record<string, unknown> }): string | null => {
    const token = request.headers[TRIAL_TOKEN_HEADER];
    return typeof token === "string" ? token : null;
  };
  const suggestionPerTrial = rateLimitHook(
    rateLimits.topicSuggestionPerTrial,
    (request) => (request.session === null ? trialTokenOf(request) : null),
    clock,
  );
  const suggestionPerAddress = rateLimitHook(
    rateLimits.topicSuggestionPerAddress,
    (request) => (request.session === null ? request.clientAddress : null),
    clock,
  );
  app.post(
    "/generations/topic-suggestions",
    { config: { optionalSession: true }, preHandler: [smallPassLimit, suggestionPerTrial, suggestionPerAddress] },
    async (request) => {
      const input = parseOrThrow(TopicSuggestionInput, request.body, "The topic suggestions");
      if (request.session === null) {
        const trialToken = trialTokenOf(request);
        if (trialToken === null) {
          throw new ApiError("unauthenticated", "Sign in, or start a trial, to have topics suggested");
        }
        if ((await trials.used(trialToken)) === null) {
          throw new ApiError("unauthenticated", "This trial isn't known here", { trial: "unknown" });
        }
      }
      const result: TopicSuggestionResult = await smallPass((passes) => passes.topicSuggestions(input, request.log));
      return result;
    },
  );

  app.post("/generations", { bodyLimit: GENERATION_BODY_LIMIT_BYTES, config: { optionalSession: true } }, async (request, reply) => {
    const body = parseOrThrow(OurKeyGenerationRequest, request.body, "The generation request");
    const trialToken = request.headers[TRIAL_TOKEN_HEADER];
    if (request.session === null && typeof trialToken !== "string") {
      throw new ApiError("unauthenticated", "Sign in, or start a trial, to make an overview on us");
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
        throw new ApiError("unavailable", "Overviews on us aren't available right now");
      }
      if (error instanceof OurKeyGenerationError) {
        throw new ApiError("generation_failed", error.message, { fallback: error.fallback });
      }
      throw error;
    }
  });
}
