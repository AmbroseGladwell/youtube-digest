import type { FastifyBaseLogger } from "fastify";
import { costInDollars, priceOf, promptTokensOf, type TokenUsage } from "@overview/generation";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { chatModel } from "./chatModel.js";

export interface ChatCost {
  inputTokens: number;
  cachedShare: number | null;
  outputTokens: number;
  costDollars: number | null;
}

// A call's tokens at list price into the account's cost tally, area chat, and what the log line
// says of them (docs/architecture/unit-economics.md).
export async function recordChatCost(
  { costs, clock }: { costs: AccountCostsRepository; clock: () => Date },
  accountId: AccountId,
  usage: TokenUsage | null,
  detail: string,
  log: FastifyBaseLogger,
): Promise<ChatCost> {
  if (usage === null) return { inputTokens: 0, cachedShare: null, outputTokens: 0, costDollars: null };
  const price = priceOf(chatModel);
  const inputTokens = promptTokensOf(usage);
  const costDollars = price === undefined ? null : costInDollars(price, usage);
  if (costDollars !== null) {
    await costs.recordOrLog(
      clock(),
      { accountId },
      { area: "chat", detail, quantity: inputTokens + usage.outputTokens, dollars: costDollars },
      log,
    );
  }
  return {
    inputTokens,
    cachedShare: inputTokens === 0 ? null : Math.round((usage.cachedInputTokens / inputTokens) * 100) / 100,
    outputTokens: usage.outputTokens,
    costDollars,
  };
}
