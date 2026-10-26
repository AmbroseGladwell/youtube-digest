import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, TRIAL_OVERVIEWS, type Overview, type OurKeyGenerationRequest, type Plan } from "@overview/domain";
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
import { secondsToNextUsageDay, usageDay } from "../transcripts/ServiceUsageRepository.js";
import { overviewQuotas } from "../usage/overviewQuotas.js";
import type { OverviewReservationsRepository } from "../usage/OverviewReservationsRepository.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";
import { TRIAL_OVERVIEWS_PER_ADDRESS_DAILY, type TrialsRepository } from "../usage/TrialsRepository.js";
import { nextUsageMonth, secondsToNextUsageMonth } from "../usage/usageMonth.js";
import { ourKeyModel } from "./ourKeyModel.js";

export interface OurKeyGeneratorOptions {
  apiKey: string;
  dailyGenerations: number;
  signedOutDailyGenerations: number;
  usage: OverviewUsageRepository;
  reservations: OverviewReservationsRepository;
  trials: TrialsRepository;
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

export class TrialSpentError extends Error {
  constructor() {
    super("You've made the overviews you can without an account");
  }
}

// Readers sharing an address share its trial overviews on our key for the day.
export class TrialAddressSpentError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Overviews on our key without an account have run out here today");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class TrialUnknownError extends Error {
  constructor() {
    super("This trial isn't one this server knows");
  }
}

// An account, counted by the month on its plan, or a signed-out device, counted by its
// trial token and the address it asks from.
export type OurKeyCaller = { accountId: AccountId; plan: Plan } | { trialToken: string; address: string };

// The caller's slot, and how to give it back when the overview fails.
interface HeldSlot {
  used: number;
  limit: number;
  release(): Promise<void>;
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

// Makes an overview on our key through production's own generateOverview. The global day's
// slot and the caller's slot (the account's month, or the trial's) are both reserved first
// and both given back on any failure, so an overview counts once, when it succeeds
// (docs/architecture/tiers.md).
export class OurKeyGenerator {
  #options: OurKeyGeneratorOptions;

  constructor(options: OurKeyGeneratorOptions) {
    this.#options = options;
  }

  async generate(caller: OurKeyCaller, { overviewId, input }: OurKeyGenerationRequest, log: FastifyBaseLogger): Promise<Overview> {
    const { apiKey, dailyGenerations, signedOutDailyGenerations, usage, reservations, trials, http, clock } = this.#options;
    const now = clock();
    const day = usageDay(now);
    const signedOut = "trialToken" in caller;
    const logged = signedOut ? { caller: "trial" as const, plan: null } : { caller: "account" as const, plan: caller.plan };
    const dayReservation = await usage.reserveOurKeyDay(now, dailyGenerations, signedOut ? signedOutDailyGenerations : null);
    if (dayReservation === "spent") {
      log.warn(apiLogLines.ourKey.dailyCapSpent({ ...logged, limit: dailyGenerations }));
      throw new OurKeyDailyCapSpentError(secondsToNextUsageDay(now));
    }
    if (dayReservation === "signed-out-share-spent") {
      log.warn(apiLogLines.ourKey.signedOutShareSpent({ limit: signedOutDailyGenerations }));
      throw new OurKeyDailyCapSpentError(secondsToNextUsageDay(now));
    }
    const held = await this.#hold(caller, now, log).catch(async (error: unknown) => {
      await usage.releaseOurKeyDay(day, signedOut);
      throw error;
    });

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
      if (signedOut) await trials.made(now, overviewId);
      else await reservations.madeOnOurKey(now, caller.accountId, overviewId);
      const price = priceOf(ourKeyModel);
      const costDollars =
        price === undefined
          ? null
          : metered.calls.reduce((total, call) => total + (call.usage === null ? 0 : costInDollars(price, call.usage)), 0);
      log.info(
        apiLogLines.ourKey.generated({
          ...logged,
          model: ourKeyModel.model,
          attempts: metered.calls.length,
          inputTokens: tokens.input,
          outputTokens: tokens.output,
          costDollars,
          used: held.used,
          limit: held.limit,
          ms: clock().getTime() - startedAt,
        }),
      );
      return overview;
    } catch (error) {
      await held.release();
      await usage.releaseOurKeyDay(day, signedOut);
      if (error instanceof ProviderKeyRefusedError) {
        log.error(apiLogLines.ourKey.keyRefused({ model: ourKeyModel.model }));
        throw new OurKeyUnavailableError("Our key was refused by its provider", { cause: error });
      }
      const fallback = fallbackReasonOf(error);
      log.warn(
        apiLogLines.ourKey.failed({
          ...logged,
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

  async #hold(caller: OurKeyCaller, now: Date, log: FastifyBaseLogger): Promise<HeldSlot> {
    const { usage, trials } = this.#options;
    if ("accountId" in caller) {
      const reservation = await usage.reserve(now, caller.accountId, "ours", overviewQuotas[caller.plan].ours);
      if (!reservation.reserved) {
        log.info(apiLogLines.ourKey.quotaSpent({ plan: caller.plan, used: reservation.used, limit: reservation.limit }));
        throw new OurKeyQuotaSpentError(nextUsageMonth(now), secondsToNextUsageMonth(now));
      }
      return {
        used: reservation.used,
        limit: reservation.limit,
        release: () => usage.release(reservation.month, caller.accountId, "ours"),
      };
    }
    const reservation = await trials.reserve(now, caller.trialToken, caller.address);
    if (reservation.reserved) {
      return {
        used: reservation.used,
        limit: TRIAL_OVERVIEWS,
        release: () => trials.release(caller.trialToken, reservation.day, caller.address),
      };
    }
    switch (reservation.reason) {
      case "unknown":
        throw new TrialUnknownError();
      case "spent":
        log.info(apiLogLines.ourKey.trialSpent({ used: reservation.used, limit: TRIAL_OVERVIEWS }));
        throw new TrialSpentError();
      case "address-spent":
        log.warn(apiLogLines.ourKey.trialAddressSpent({ used: reservation.used, limit: TRIAL_OVERVIEWS_PER_ADDRESS_DAILY }));
        throw new TrialAddressSpentError(secondsToNextUsageDay(now));
    }
  }
}
