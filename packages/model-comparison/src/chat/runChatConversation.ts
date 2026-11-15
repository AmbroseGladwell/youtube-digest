import { costInDollars, priceOf, promptTokensOf, type TokenUsage } from "@overview/generation";
import type { Provider } from "@overview/domain";
import type { LoadedChatSource } from "./chatSources.js";
import { chatSystemPrompt, chatUserMessage, type ChatArm } from "./chatPrompt.js";
import { chatTurn, type ChatMessage, type ChatReply } from "./chatTurn.js";
import { closestPassages } from "./closestPassages.js";
import { embeddingDollars } from "./embedTexts.js";
import { locateQuote } from "./locateQuote.js";
import { scoreReply, type ReplyScore } from "./scoreReply.js";
import type { Passage } from "./transcriptPassages.js";

export interface ChatTurnRecord {
  questionId: string;
  kind: string;
  usage: TokenUsage;
  costDollars: number;
  uncachedCostDollars: number;
  queryEmbeddingDollars: number;
  latencyMs: number;
  retrieved: string[];
  reply: ChatReply | null;
  error: string | null;
  score: ReplyScore | null;
}

export interface ChatConversationRecord {
  overviewId: string;
  arm: ChatArm;
  model: string;
  repeat: number;
  windowS: number;
  retrieveCount: number;
  ranOn: string;
  pricesCheckedOn: string;
  videoMs: number;
  turns: ChatTurnRecord[];
  costDollars: number;
}

export interface ConversationSetup {
  apiKey: string;
  source: LoadedChatSource;
  arm: ChatArm;
  model: string;
  repeat: number;
  windowS: number;
  retrieveCount: number;
  passages: readonly Passage[];
  passageVectors: readonly (readonly number[])[];
  questionVectors: readonly (readonly number[])[];
  questionEmbeddingTokens: readonly number[];
}

const PROVIDER: Provider = "openai";

export async function runChatConversation(setup: ConversationSetup): Promise<ChatConversationRecord> {
  const price = priceOf({ provider: PROVIDER, model: setup.model });
  if (price === undefined) throw new Error(`no price for ${setup.model}`);
  const uncached = (usage: TokenUsage) =>
    costInDollars(price, {
      uncachedInputTokens: promptTokensOf(usage),
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: usage.outputTokens,
    });

  const { source, arm } = setup;
  const messages: ChatMessage[] = [{ role: "system", content: chatSystemPrompt(arm, source.overview, setup.passages) }];
  const cacheKey = `ov267-${source.overviewId}-${arm}-${setup.model}-${setup.repeat}-${Date.now()}`;
  const turns: ChatTurnRecord[] = [];

  for (const [index, question] of source.questions.questions.entries()) {
    const retrieved =
      arm === "fullTranscript"
        ? []
        : closestPassages(setup.passages, setup.passageVectors, setup.questionVectors[index] ?? [], setup.retrieveCount);
    const queryEmbeddingDollars = arm === "fullTranscript" ? 0 : embeddingDollars(setup.questionEmbeddingTokens[index] ?? 0);
    messages.push({ role: "user", content: chatUserMessage(arm, question.question, retrieved) });
    const momentsMs = question.quotes.map((quote) => locateQuote(source.fetched.transcript, quote) ?? -1);
    try {
      const result = await chatTurn(setup.apiKey, setup.model, messages, cacheKey);
      messages.push({ role: "assistant", content: result.raw });
      turns.push({
        questionId: question.id,
        kind: question.kind,
        usage: result.usage,
        costDollars: costInDollars(price, result.usage),
        uncachedCostDollars: uncached(result.usage),
        queryEmbeddingDollars,
        latencyMs: result.latencyMs,
        retrieved: retrieved.map((passage) => passage.id),
        reply: result.reply,
        error: null,
        score: scoreReply(question, momentsMs, result.reply, setup.passages),
      });
    } catch (error) {
      messages.pop();
      turns.push({
        questionId: question.id,
        kind: question.kind,
        usage: { uncachedInputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 },
        costDollars: 0,
        uncachedCostDollars: 0,
        queryEmbeddingDollars,
        latencyMs: 0,
        retrieved: retrieved.map((passage) => passage.id),
        reply: null,
        error: error instanceof Error ? error.message : String(error),
        score: null,
      });
    }
  }

  return {
    overviewId: source.overviewId,
    arm,
    model: setup.model,
    repeat: setup.repeat,
    windowS: setup.windowS,
    retrieveCount: setup.retrieveCount,
    ranOn: new Date().toISOString().slice(0, 10),
    pricesCheckedOn: price.checkedOn,
    videoMs: source.fetched.transcript.at(-1)?.endMs ?? 0,
    turns,
    costDollars: turns.reduce((sum, turn) => sum + turn.costDollars + turn.queryEmbeddingDollars, 0),
  };
}
