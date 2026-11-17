import type { FastifyBaseLogger } from "fastify";
import {
  apiLogLines,
  Chat,
  CHAT_MIGRATIONS,
  chatQuestionCount,
  chatRecordId,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CHAT_QUESTIONS,
  Overview,
  OVERVIEW_MIGRATIONS,
  overviewMarkdown,
  overviewParts,
  readStoredRecord,
  sourceKey,
  stampSchemaVersion,
  StoredTranscript,
  type ChatMessage,
  type ChatQuestionRequest,
  type ChatStreamEvent,
  type Plan,
} from "@overview/domain";
import { costInDollars, priceOf, promptTokensOf, type TokenUsage } from "@overview/generation";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { ApiError } from "../http/ApiError.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import { secondsToNextUsageDay } from "../transcripts/ServiceUsageRepository.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import type { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { secondsToNextUsageMonth, nextUsageMonth } from "../usage/usageMonth.js";
import { answerSoFar } from "./answerSoFar.js";
import { withoutCitationMarks } from "./withoutCitationMarks.js";
import { appendChatMessages } from "./appendChatMessages.js";
import { ChatReply } from "./ChatReply.js";
import { chatModel } from "./chatModel.js";
import { chatSystemPrompt, otherChatsPrompt, type ChatSourceKind } from "./chatPrompt.js";
import { citationsOf } from "./citationsOf.js";
import { otherChatsInPrompt } from "./otherChatsInPrompt.js";
import { ChatProviderError, streamChatCompletion, type ChatCompletionStream, type PromptMessage } from "./streamChatCompletion.js";
import { transcriptPassages } from "./transcriptPassages.js";

export interface ChatAnswererOptions {
  apiKey: string;
  http: typeof fetch;
  dailyMessages: number;
  records: RecordsRepository;
  transcripts: TranscriptsRepository;
  usage: ChatUsageRepository;
  costs: AccountCostsRepository;
  clock: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface ChatCaller {
  accountId: AccountId;
  plan: Plan;
}

const FAILED = "Something went wrong answering that. Try again in a while.";

const readChat = (record: StoredRecord): Chat | null => {
  const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Chat, CHAT_MIGRATIONS);
  return read.status === "read" ? read.record : null;
};

// Answers a reader's question about one overview from their own transcript, on our key,
// within their plan's monthly allowance. Everything that can refuse is settled before the
// answer starts to stream; once it has, a failure gives the message back and says so in
// the stream (docs/features/chats.md, "Asking").
export class ChatAnswerer {
  #options: ChatAnswererOptions;

  constructor(options: ChatAnswererOptions) {
    this.#options = options;
  }

  async ask(
    caller: ChatCaller,
    overviewId: string,
    question: ChatQuestionRequest,
    log: FastifyBaseLogger,
  ): Promise<AsyncGenerator<ChatStreamEvent>> {
    const { records, usage, clock, dailyMessages } = this.#options;
    const { accountId, plan } = caller;
    const overview = await this.#overview(accountId, overviewId);
    const { kind, passages } = await this.#source(accountId, overview);
    const id = chatRecordId(overviewId, question.conversationId);
    const current = await records.read(accountId, "chat", id);
    if (current?.deleted === true) throw new ApiError("not_found", "That conversation was deleted");
    const conversation = current === null ? null : readChat(current);
    if (conversation !== null && chatQuestionCount(conversation.messages) >= MAX_CHAT_QUESTIONS) {
      throw new ApiError("invalid_request", "This conversation is as long as it can get. Start a new one to keep asking.", {
        conversation: "full",
      });
    }
    const others = (await records.listLive(accountId, "chat", chatRecordId(overviewId, "%")))
      .filter((record) => record.id !== id)
      .flatMap((record) => readChat(record) ?? []);

    const askedAt = clock();
    const reservation = await usage.reserve(askedAt, accountId, plan, dailyMessages);
    if (!reservation.reserved) {
      if (reservation.quota === "our-key-daily") {
        log.warn(apiLogLines.chat.dailyCapSpent({ limit: dailyMessages }));
        throw new ApiError("too_many_requests", "We've answered as many questions as we can today. Try again tomorrow.", {
          quota: "chat-our-key-daily",
          retryAfterSeconds: secondsToNextUsageDay(askedAt),
        });
      }
      log.info(apiLogLines.chat.allowanceSpent({ plan, quota: reservation.quota, used: reservation.used, limit: reservation.limit }));
      throw reservation.quota === "month"
        ? new ApiError("too_many_requests", "You've asked this month's questions on us.", {
            quota: "chat-month",
            resetsOn: nextUsageMonth(askedAt),
            retryAfterSeconds: secondsToNextUsageMonth(askedAt),
          })
        : new ApiError("too_many_requests", "You've asked as many questions as you can today.", {
            quota: "chat-day",
            retryAfterSeconds: secondsToNextUsageDay(askedAt),
          });
    }

    const othersInPrompt = otherChatsInPrompt(others);
    const othersText = otherChatsPrompt(kind, othersInPrompt);
    const prompt: PromptMessage[] = [
      { role: "system", content: chatSystemPrompt(kind, overviewMarkdown(overview, { partIds: true }), passages) },
      ...(othersText === null ? [] : [{ role: "user" as const, content: othersText }]),
      ...(conversation?.messages ?? []).map((message): PromptMessage => ({
        role: message.from === "reader" ? "user" : "assistant",
        content: message.text,
      })),
      { role: "user", content: question.text },
    ];
    const logged = { plan, model: chatModel.model, otherChatMessages: othersInPrompt.messages };
    const startedAt = askedAt.getTime();
    const release = () => usage.release(reservation.day, accountId);

    let stream: ChatCompletionStream;
    try {
      stream = await streamChatCompletion(
        {
          apiKey: this.#options.apiKey,
          http: this.#options.http,
          sleep: this.#options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
          retried: (status) => log.info(apiLogLines.chat.retried({ status })),
        },
        prompt,
        `chat-${overviewId}`,
      );
    } catch (error) {
      await release();
      log.warn(apiLogLines.chat.failed({ ...logged, reason: reasonOf(error), status: statusOf(error), ms: clock().getTime() - startedAt }));
      if (statusOf(error) === 401 || statusOf(error) === 403) {
        throw new ApiError("unavailable", "Questions on us aren't available right now");
      }
      throw new ApiError("generation_failed", FAILED);
    }

    const answer = async function* (this: ChatAnswerer): AsyncGenerator<ChatStreamEvent> {
      let raw = "";
      let sent = "";
      let settled = false;
      try {
        for await (const piece of stream.pieces) {
          raw += piece;
          const text = withoutCitationMarks(answerSoFar(raw), { arriving: true });
          if (text.length > sent.length && text.startsWith(sent)) {
            yield { type: "text", text: text.slice(sent.length) };
            sent = text;
          }
        }
        const reply = ChatReply.parse(JSON.parse(raw));
        const text = withoutCitationMarks(reply.answer).slice(0, MAX_CHAT_MESSAGE_LENGTH);
        if (text.length === 0) throw new Error("the reply had no answer");
        const cited = citationsOf(reply, passages, overviewParts(overview), othersInPrompt.labels);
        const messages: ChatMessage[] = [
          { from: "reader", text: question.text, at: askedAt.toISOString() },
          { from: "answer", text, at: clock().toISOString(), citations: cited.citations, inSource: cited.inSource },
        ];
        const written = await appendChatMessages(
          records,
          accountId,
          { overviewId, conversationId: question.conversationId, messages },
          clock(),
        );
        settled = true;
        const cost = await this.#recordCost(accountId, stream.usage(), "message", log);
        log.info(
          apiLogLines.chat.answered({
            ...logged,
            ...cost,
            inSource: cited.inSource,
            sourceCitations: cited.sourceCitations,
            overviewCitations: cited.overviewCitations,
            chatCitations: cited.chatCitations,
            used: reservation.used,
            limit: reservation.limit,
            ms: clock().getTime() - startedAt,
          }),
        );
        yield { type: "answered", chatId: id, rev: written.rev, messages };
      } catch (error) {
        settled = true;
        await release();
        const cost = await this.#recordCost(accountId, stream.usage(), "message-failed", log);
        log.warn(
          apiLogLines.chat.failed({
            ...logged,
            ...cost,
            reason: reasonOf(error),
            status: statusOf(error),
            ms: clock().getTime() - startedAt,
          }),
        );
        yield { type: "failed", message: FAILED };
      } finally {
        // The reader stopped, or went, before the answer was stored: stop asking, store
        // nothing, and give the question back. The provider reports tokens only at the end,
        // so what it billed for the part already written can't be priced.
        if (!settled) {
          await stream.pieces.return(undefined);
          await release();
          log.info(apiLogLines.chat.stopped({ ...logged, ms: clock().getTime() - startedAt }));
        }
      }
    };
    return answer.call(this);
  }

  async #overview(accountId: AccountId, overviewId: string): Promise<Overview> {
    const record = await this.#options.records.read(accountId, "overview", overviewId);
    if (record === null || record.deleted) throw new ApiError("not_found", "No such overview");
    const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
    if (read.status !== "read") throw new ApiError("not_found", "No such overview");
    return read.record;
  }

  // Only what the account holds itself: no transcript, no chat, and the panel hides
  // (docs/features/chats.md, "No transcript, no chat").
  async #source(
    accountId: AccountId,
    overview: Overview,
  ): Promise<{ kind: ChatSourceKind; passages: ReturnType<typeof transcriptPassages> }> {
    const { source } = overview;
    const key = source.kind === "web" ? null : sourceKey(source);
    const stored = key === null ? null : StoredTranscript.safeParse(await this.#options.transcripts.get(accountId, key));
    const passages = stored?.success === true ? transcriptPassages(stored.data.segments) : [];
    if (passages.length === 0) {
      throw new ApiError("transcript_unavailable", "There's no transcript kept for this overview to answer from", { chat: "no-source" });
    }
    return { kind: source.kind === "podcast" ? "episode" : "video", passages };
  }

  async #recordCost(
    accountId: AccountId,
    usage: TokenUsage | null,
    detail: string,
    log: FastifyBaseLogger,
  ): Promise<{ inputTokens: number; cachedShare: number | null; outputTokens: number; costDollars: number | null }> {
    if (usage === null) return { inputTokens: 0, cachedShare: null, outputTokens: 0, costDollars: null };
    const price = priceOf(chatModel);
    const inputTokens = promptTokensOf(usage);
    const costDollars = price === undefined ? null : costInDollars(price, usage);
    if (costDollars !== null) {
      await this.#options.costs.recordOrLog(
        this.#options.clock(),
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
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.constructor.name : "unknown");
const statusOf = (error: unknown): number | null => (error instanceof ChatProviderError ? error.status : null);
