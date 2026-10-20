import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, type Overview, type OurKeyGenerationRequest, type Plan } from "@overview/domain";
import {
  costInDollars,
  createGenerationClient,
  fallbackReasonOf,
  generateOverview,
  meteredFetch,
  priceOf,
  ProviderKeyRefusedError,
  type FallbackReason,
} from "@overview/generation";
import type { AccountId } from "../auth/AccountId.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";
import { overviewQuotas } from "../usage/overviewQuotas.js";
import type { OverviewReservationsRepository } from "../usage/OverviewReservationsRepository.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";
import { nextUsageMonth, secondsToNextUsageMonth } from "../usage/usageMonth.js";
import { ourKeyModel } from "./ourKeyModel.js";

export interface OurKeyGeneratorOptions {
  apiKey: string;
  dailyGenerations: number;
  usage: OverviewUsageRepository;
  reservations: OverviewReservationsRepository;
  http: typeof fetch;
  clock: () => Date;
}

export class OurKeyQuotaSpentError extends Error {
  readonly resetsOn: string;
  readonly retryAfterSeconds: number;

  constructor(resetsOn: string, retryAfterSeconds: number) {
    super("You've made this month's overviews on our key");
    this.resetsOn = resetsOn;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OurKeyDailyCapSpentError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Our key has made as many overviews as it can today");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Our own key refused by the provider: ours to fix, never the reader's key problem.
export class OurKeyUnavailableError extends Error {}

export class OurKeyGenerationError extends Error {
  readonly fallback: FallbackReason | null;

  constructor(fallback: FallbackReason | null, cause: unknown) {
    super("The overview couldn't be made on our key", { cause });
    this.fallback = fallback;
  }
}

const secondsToNextDay = (now: Date): number =>
  Math.max(1, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000));

// Makes an overview on our key through production's own generateOverview. The global day's
// slot and the account's month's slot are both reserved first and both given back on any
// failure, so an overview counts once, when it succeeds (docs/architecture/tiers.md).
export class OurKeyGenerator {
  #options: OurKeyGeneratorOptions;

  constructor(options: OurKeyGeneratorOptions) {
    this.#options = options;
  }

  async generate(
    { accountId, plan }: { accountId: AccountId; plan: Plan },
    { overviewId, input }: OurKeyGenerationRequest,
    log: FastifyBaseLogger,
  ): Promise<Overview> {
    const { apiKey, dailyGenerations, usage, reservations, http, clock } = this.#options;
    const now = clock();
    const day = usageDay(now);
    if (!(await usage.reserveOurKeyDay(now, dailyGenerations))) {
      log.warn(apiLogLines.ourKey.dailyCapSpent({ plan, limit: dailyGenerations }));
      throw new OurKeyDailyCapSpentError(secondsToNextDay(now));
    }
    const reservation = await usage.reserve(now, accountId, "ours", overviewQuotas[plan].ours);
    if (!reservation.reserved) {
      await usage.releaseOurKeyDay(day);
      log.info(apiLogLines.ourKey.quotaSpent({ plan, used: reservation.used, limit: reservation.limit }));
      throw new OurKeyQuotaSpentError(nextUsageMonth(now), secondsToNextUsageMonth(now));
    }

    const metered = meteredFetch(ourKeyModel.provider, http);
    const startedAt = now.getTime();
    try {
      const overview = await generateOverview(
        createGenerationClient({ ...ourKeyModel, apiKey, http: metered.http }),
        input,
        { id: overviewId, savedAt: now.toISOString() },
      );
      const tokens = metered.calls.reduce(
        (total, call) => ({
          input: total.input + (call.usage === null ? 0 : call.usage.uncachedInputTokens + call.usage.cachedInputTokens),
          output: total.output + (call.usage?.outputTokens ?? 0),
        }),
        { input: 0, output: 0 },
      );
      await reservations.madeOnOurKey(now, accountId, overviewId);
      const price = priceOf(ourKeyModel);
      const costDollars =
        price === undefined
          ? null
          : metered.calls.reduce((total, call) => total + (call.usage === null ? 0 : costInDollars(price, call.usage)), 0);
      log.info(
        apiLogLines.ourKey.generated({
          plan,
          model: ourKeyModel.model,
          attempts: metered.calls.length,
          inputTokens: tokens.input,
          outputTokens: tokens.output,
          costDollars,
          used: reservation.used,
          limit: reservation.limit,
          ms: clock().getTime() - startedAt,
        }),
      );
      return overview;
    } catch (error) {
      await usage.release(reservation.month, accountId, "ours");
      await usage.releaseOurKeyDay(day);
      if (error instanceof ProviderKeyRefusedError) {
        log.error(apiLogLines.ourKey.keyRefused({ model: ourKeyModel.model }));
        throw new OurKeyUnavailableError("Our key was refused by its provider", { cause: error });
      }
      const fallback = fallbackReasonOf(error);
      log.warn(
        apiLogLines.ourKey.failed({
          plan,
          reason: error instanceof Error ? error.constructor.name : "unknown",
          status: (error as { status?: unknown }).status ?? null,
          fallback,
          attempts: metered.calls.length,
          ms: clock().getTime() - startedAt,
        }),
      );
      throw new OurKeyGenerationError(fallback, error);
    }
  }
}
