import type { FastifyBaseLogger } from "fastify";
import {
  apiLogLines,
  TRIAL_OVERVIEWS,
  type ForAnyoneInput,
  type NoteKind,
  type Overview,
  type OurKeyGenerationRequest,
  type Plan,
  type ProfilePassInput,
  type ProfilePassItem,
  type TopicMatchInput,
  type TopicSuggestionInput,
  type TopicSuggestionResult,
} from "@overview/domain";
import {
  costInDollars,
  createGenerationClient,
  fallbackReasonOf,
  generateForAnyoneSteps,
  generateOverviewOf,
  generateProfileItems,
  generateTopicMatches,
  generateTopicSuggestions,
  meteredFetch,
  priceOf,
  promptTokensOf,
  ProviderKeyRefusedError,
  type FallbackReason,
  type GenerationClient,
  type MeteredCall,
} from "@overview/generation";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository, CostPayer } from "../costs/AccountCostsRepository.js";
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
  costs: AccountCostsRepository;
  http: typeof fetch;
  clock: () => Date;
}

export class OurKeyQuotaSpentError extends Error {
  readonly resetsOn: string;
  readonly retryAfterSeconds: number;

  constructor(resetsOn: string, retryAfterSeconds: number) {
    super("You've made this month's overviews on us");
    this.resetsOn = resetsOn;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OurKeyDailyCapSpentError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("We've made as many overviews on us as we can today");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class TrialSpentError extends Error {
  constructor() {
    super("You've made the overviews you can without an account. Sign up to keep going.");
  }
}

// Readers sharing an address share its trial overviews on our key for the day.
export class TrialAddressSpentError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Overviews on us without an account have run out on this network today. Sign up, or add your own key, to keep going.");
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

export type SmallPass = "profile" | "forAnyone" | "topics" | "topicSuggestions";

// The caller's slot, and how to give it back when the overview fails.
interface HeldSlot {
  used: number;
  limit: number;
  release(): Promise<void>;
}

// Our own key refused by the provider: ours to fix, never the reader's key problem.
export class OurKeyUnavailableError extends Error {}

// What a run of calls on our key used and cost, failed attempts included, since the provider
// bills every response it answers.
function meteredUsageOf(calls: MeteredCall[]): { inputTokens: number; outputTokens: number; costDollars: number | null } {
  const price = priceOf(ourKeyModel);
  return calls.reduce(
    (total, { usage }) =>
      usage === null
        ? total
        : {
            inputTokens: total.inputTokens + promptTokensOf(usage),
            outputTokens: total.outputTokens + usage.outputTokens,
            costDollars: total.costDollars === null || price === undefined ? null : total.costDollars + costInDollars(price, usage),
          },
    { inputTokens: 0, outputTokens: 0, costDollars: price === undefined ? null : 0 },
  );
}

export class OurKeyGenerationError extends Error {
  readonly fallback: FallbackReason | null;

  constructor(fallback: FallbackReason | null, cause: unknown) {
    super("Something went wrong making this overview. Try again in a while.", { cause });
    this.fallback = fallback;
  }
}

// Makes an overview on our key through production's own generation. The global day's
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
    const payer: CostPayer = signedOut ? "signed-out" : { accountId: caller.accountId };
    // The kind check's calls are costed on their own line, apart from the note's
    // (docs/architecture/unit-economics.md); an article has no check.
    let noteKind: NoteKind | null = null;
    let checkCalls = 0;
    const observer = {
      kindChecked: (kind: NoteKind) => {
        noteKind = kind;
        checkCalls = metered.calls.length;
      },
    };
    const recordCosts = async (failed: boolean) => {
      const checkEnded = noteKind !== null || "article" in input ? checkCalls : metered.calls.length;
      const suffix = failed ? "-failed" : "";
      await this.#recordCost(metered.calls.slice(0, checkEnded), payer, noteKind === null ? `kindCheck${suffix}` : "kindCheck", log);
      await this.#recordCost(metered.calls.slice(checkEnded), payer, `overview${suffix}`, log);
    };
    try {
      const overview = await generateOverviewOf(
        createGenerationClient({ ...ourKeyModel, apiKey, http: metered.http }),
        input,
        { id: overviewId, savedAt: now.toISOString() },
        observer,
      );
      if (signedOut) await trials.made(now, overviewId);
      else await reservations.madeOnOurKey(now, caller.accountId, overviewId);
      await recordCosts(false);
      log.info(
        apiLogLines.ourKey.generated({
          ...logged,
          model: ourKeyModel.model,
          noteKind,
          attempts: metered.calls.length,
          ...meteredUsageOf(metered.calls),
          used: held.used,
          limit: held.limit,
          ms: clock().getTime() - startedAt,
        }),
      );
      return overview;
    } catch (error) {
      await held.release();
      await usage.releaseOurKeyDay(day, signedOut);
      await recordCosts(true);
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
          model: ourKeyModel.model,
          noteKind,
          attempts: metered.calls.length,
          ...meteredUsageOf(metered.calls),
          ms: clock().getTime() - startedAt,
        }),
      );
      throw new OurKeyGenerationError(fallback, error);
    }
  }

  // Small passes for an account: no overview is made, so nothing counts against the plan or
  // the day's overviews, and their routes share a limit of their own
  // (docs/features/personalisation.md).
  profilePass(payer: CostPayer, input: ProfilePassInput, log: FastifyBaseLogger): Promise<ProfilePassItem[]> {
    return this.#smallPass("profile", payer, (client) => generateProfileItems(client, input), log);
  }

  forAnyone(payer: CostPayer, input: ForAnyoneInput, log: FastifyBaseLogger): Promise<string[]> {
    return this.#smallPass("forAnyone", payer, (client) => generateForAnyoneSteps(client, input), log);
  }

  topics(payer: CostPayer, input: TopicMatchInput, log: FastifyBaseLogger): Promise<string[]> {
    return this.#smallPass("topics", payer, (client) => generateTopicMatches(client, input), log);
  }

  topicSuggestions(payer: CostPayer, input: TopicSuggestionInput, log: FastifyBaseLogger): Promise<TopicSuggestionResult> {
    return this.#smallPass("topicSuggestions", payer, (client) => generateTopicSuggestions(client, input), log);
  }

  async #smallPass<Result>(
    pass: SmallPass,
    payer: CostPayer,
    run: (client: GenerationClient) => Promise<Result>,
    log: FastifyBaseLogger,
  ): Promise<Result> {
    const { apiKey, http, clock } = this.#options;
    const startedAt = clock().getTime();
    const metered = meteredFetch(ourKeyModel.provider, http);
    const recordCost = (detail: string) => this.#recordCost(metered.calls, payer, detail, log);
    try {
      const result = await run(createGenerationClient({ ...ourKeyModel, apiKey, http: metered.http }));
      await recordCost(pass);
      log.info(
        apiLogLines.ourKey.smallPass({
          pass,
          model: ourKeyModel.model,
          costDollars: meteredUsageOf(metered.calls).costDollars,
          ms: clock().getTime() - startedAt,
        }),
      );
      return result;
    } catch (error) {
      await recordCost(`${pass}-failed`);
      log.warn(
        apiLogLines.ourKey.smallPassFailed({
          pass,
          reason: error instanceof Error ? error.constructor.name : "unknown",
          model: ourKeyModel.model,
          costDollars: meteredUsageOf(metered.calls).costDollars,
          ms: clock().getTime() - startedAt,
        }),
      );
      throw new OurKeyGenerationError(fallbackReasonOf(error), error);
    }
  }

  async #recordCost(calls: MeteredCall[], payer: CostPayer, detail: string, log: FastifyBaseLogger): Promise<void> {
    const { inputTokens, outputTokens, costDollars } = meteredUsageOf(calls);
    if (costDollars === null || calls.every((call) => call.usage === null)) return;
    const { costs, clock } = this.#options;
    await costs.recordOrLog(
      clock(),
      payer,
      { area: "generation", detail, quantity: inputTokens + outputTokens, dollars: costDollars },
      log,
    );
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
