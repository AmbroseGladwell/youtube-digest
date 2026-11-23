import type { FastifyBaseLogger } from "fastify";
import { costInDollars, priceOf, promptTokensOf, type PricedModel, type TokenUsage } from "@overview/generation";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";

export interface RecordQuestionCostOptions {
  costs: AccountCostsRepository;
  clock: () => Date;
}

// At list price, as chat's are; a call with no price is left out, never recorded as free.
export const recordQuestionCost = async (
  { costs, clock }: RecordQuestionCostOptions,
  accountId: AccountId,
  model: PricedModel,
  usage: TokenUsage | null,
  detail: string,
  log: FastifyBaseLogger,
): Promise<void> => {
  const price = priceOf(model);
  if (usage === null || price === undefined) {
    return;
  }
  await costs.recordOrLog(
    clock(),
    { accountId },
    { area: "questions", detail, quantity: promptTokensOf(usage) + usage.outputTokens, dollars: costInDollars(price, usage) },
    log,
  );
};
