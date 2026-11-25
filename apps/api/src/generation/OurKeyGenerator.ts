import type { FastifyBaseLogger } from "fastify";
import {
  overviewQuotas,
  apiLogLines,
  type NoteKind,
  type OurKeyGenerationRequest,
  type OurKeyGenerationResult,
  type Plan,
  type ProfilePassInput,
  type ProfilePassItem,
  type ProjectId,
  type TopicMatchInput,
  type TopicSuggestionInput,
  type TopicSuggestionResult,
} from "@overview/domain";
import {
  checkNoteKind,
  costInDollars,
  createGenerationClient,
  fallbackReasonOf,
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
  type KindSample,
  type MeteredCall,
} from "@overview/generation";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository, CostPayer } from "../costs/AccountCostsRepository.js";
import { secondsToNextUsageDay, usageDay } from "../transcripts/ServiceUsageRepository.js";
import type { OverviewReservationsRepository } from "../usage/OverviewReservationsRepository.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";
import { nextUsageMonth, secondsToNextUsageMonth } from "../usage/usageMonth.js";
import { ourKeyModel } from "./ourKeyModel.js";

export interface OurKeyGeneratorOptions {
  apiKey: string;
  dailyGenerations: number;
  usage: OverviewUsageRepository;
  reservations: OverviewReservationsRepository;
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

export interface OurKeyCaller {
  accountId: AccountId;
  plan: Plan;
}

export type SmallPass = "profile" | "topics" | "topicSuggestions" | "kindCheck";

interface HeldSlot {
  used: number;
  limit: number;
  release(): Promise<void>;
}

// Our own key refused by the provider: ours to fix, never the reader's key problem.
export class OurKeyUnavailableError extends Error {}

interface MeteredUsage {
  inputTokens: number;
  outputTokens: number;
  costDollars: number | null;
}

// Failed attempts included, since the provider bills every response it answers.
const meteredUsageOf = (calls: MeteredCall[]): MeteredUsage => {
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
};

export class OurKeyGenerationError extends Error {
  readonly fallback: FallbackReason | null;

  constructor(fallback: FallbackReason | null, cause: unknown) {
    super("Something went wrong making this overview. Try again in a while.", { cause });
    this.fallback = fallback;
  }
}

// How overviews are counted: docs/architecture/tiers.md, "Counting".
export class OurKeyGenerator {
  #options: OurKeyGeneratorOptions;

  constructor(options: OurKeyGeneratorOptions) {
    this.#options = options;
  }

  async generate(
    caller: OurKeyCaller,
    { overviewId, input }: OurKeyGenerationRequest,
    log: FastifyBaseLogger,
  ): Promise<OurKeyGenerationResult> {
    const { apiKey, dailyGenerations, usage, reservations, http, clock } = this.#options;
    const now = clock();
    const day = usageDay(now);
    const logged = { caller: "account" as const, plan: caller.plan };
    if (!(await usage.reserveOurKeyDay(now, dailyGenerations))) {
      log.warn(apiLogLines.ourKey.dailyCapSpent({ ...logged, limit: dailyGenerations }));
      throw new OurKeyDailyCapSpentError(secondsToNextUsageDay(now));
    }
    const held = await this.#hold(caller, now, log).catch(async (error: unknown) => {
      await usage.releaseOurKeyDay(day);
      throw error;
    });

    const metered = meteredFetch(ourKeyModel.provider, http);
    const startedAt = now.getTime();
    const payer: CostPayer = { accountId: caller.accountId };
    // Costed on its own line: docs/architecture/unit-economics.md, "What is recorded".
    let noteKind: NoteKind | null = null;
    let checkCalls = 0;
    let filedProjectIds: ProjectId[] = [];
    const observer = {
      kindChecked: (kind: NoteKind) => {
        noteKind = kind;
        checkCalls = metered.calls.length;
      },
      projectsFiled: (ids: ProjectId[]) => {
        filedProjectIds = ids;
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
      await reservations.madeOnOurKey(now, caller.accountId, overviewId);
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
      return { ...overview, filedProjectIds };
    } catch (error) {
      await held.release();
      await usage.releaseOurKeyDay(day);
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

  // Why nothing counts against the plan: docs/features/personalisation.md, "A profile that learns".
  profilePass(payer: CostPayer, input: ProfilePassInput, log: FastifyBaseLogger): Promise<ProfilePassItem[]> {
    return this.#smallPass("profile", payer, (client) => generateProfileItems(client, input), log);
  }

  topics(payer: CostPayer, input: TopicMatchInput, log: FastifyBaseLogger): Promise<string[]> {
    return this.#smallPass("topics", payer, (client) => generateTopicMatches(client, input), log);
  }

  topicSuggestions(payer: CostPayer, input: TopicSuggestionInput, log: FastifyBaseLogger): Promise<TopicSuggestionResult> {
    return this.#smallPass("topicSuggestions", payer, (client) => generateTopicSuggestions(client, input), log);
  }

  kindCheck(payer: CostPayer, sample: KindSample, log: FastifyBaseLogger): Promise<NoteKind> {
    return this.#smallPass("kindCheck", payer, (client) => checkNoteKind(client, sample), log);
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
    if (costDollars === null || calls.every((call) => call.usage === null)) {
      return;
    }
    const { costs, clock } = this.#options;
    await costs.recordOrLog(
      clock(),
      payer,
      { area: "generation", detail, quantity: inputTokens + outputTokens, dollars: costDollars },
      log,
    );
  }

  async #hold(caller: OurKeyCaller, now: Date, log: FastifyBaseLogger): Promise<HeldSlot> {
    const { usage } = this.#options;
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
}
