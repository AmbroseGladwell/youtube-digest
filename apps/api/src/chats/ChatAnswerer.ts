import type { FastifyBaseLogger } from "fastify";
import {
  answeredFromOverviewAlone,
  apiLogLines,
  Chat,
  chatSourceKind,
  CHAT_MIGRATIONS,
  composeReaderContext,
  chatQuestionCount,
  chatRecordId,
  chatUnitsOf,
  MAX_CHAT_QUESTIONS,
  Overview,
  OVERVIEW_MIGRATIONS,
  overviewMarkdown,
  PROJECT_MIGRATIONS,
  Project,
  overviewParts,
  readStoredRecord,
  sourceKey,
  stampSchemaVersion,
  StoredTranscript,
  type ChatMessage,
  type ChatQuestionRequest,
  type ChatSource,
  type ChatSourceKind,
  type ChatStreamEvent,
  type OverviewId,
  type Plan,
} from "@overview/domain";
import type { TokenUsage } from "@overview/generation";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import type { MeaningSearch } from "../meaning/MeaningSearch.js";
import type { TranscriptPassagesRepository } from "../transcripts/TranscriptPassagesRepository.js";
import { ApiError } from "../http/ApiError.js";
import { readSettings } from "../records/readSettings.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import type { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { answerSoFar } from "./answerSoFar.js";
import { arrivedSections } from "./arrivedSections.js";
import { outsideCode } from "./outsideCode.js";
import { flattenedAnswer, structuredAnswer, withoutDashes } from "./structuredAnswer.js";
import { assertWhole, CHAT_FAILED as FAILED, EmptyAnswerError, reasonOf, statusOf } from "./chatFailure.js";
import { recordChatCost, type ChatCost } from "./recordChatCost.js";
import { reserveChatMessage } from "./reserveChatMessage.js";
import { withoutCitationMarks } from "./withoutCitationMarks.js";
import { appendChatMessages } from "./appendChatMessages.js";
import { allIds, ChatReply, citedIds } from "./ChatReply.js";
import { chatModel } from "./chatModel.js";
import { chatSystemPrompt, otherChatsPrompt } from "./chatPrompt.js";
import { chooseOtherSources } from "./chooseOtherSources.js";
import { citationsOf } from "./citationsOf.js";
import { keywordMinutes, transcriptMinutes } from "./keywordMinutes.js";
import { otherChatsInPrompt } from "./otherChatsInPrompt.js";
import { otherSourcesInPrompt, type OtherSourcesInPrompt, type SourcesTurn } from "./otherSourcesInPrompt.js";
import { streamChatCompletion, type ChatCompletionStream, type PromptMessage } from "./streamChatCompletion.js";
import { transcriptPassages, type Passage } from "./transcriptPassages.js";

export interface ChatAnswererOptions {
  apiKey: string;
  http: typeof fetch;
  dailyMessages: number;
  records: RecordsRepository;
  transcripts: TranscriptsRepository;
  usage: ChatUsageRepository;
  costs: AccountCostsRepository;
  meaningSearch: MeaningSearch | null;
  passages: TranscriptPassagesRepository | null;
  clock: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface ChatCaller {
  accountId: AccountId;
  plan: Plan;
  acrossSources: boolean;
}

interface OtherSourcesTurn {
  added: ChatSource[];
  setAside: string[];
  minutes: Array<{ overviewId: OverviewId; passages: Passage[] }>;
  searched: boolean;
  inPrompt: OtherSourcesInPrompt;
}

const NO_OTHER_SOURCES: OtherSourcesTurn = {
  added: [],
  setAside: [],
  minutes: [],
  searched: false,
  inPrompt: { blocks: [], labels: new Map(), minuteLabels: new Map() },
};

const readChat = (record: StoredRecord): Chat | null => {
  const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Chat, CHAT_MIGRATIONS);
  return read.status === "read" ? read.record : null;
};

export interface SourcePassages {
  kind: ChatSourceKind;
  passages: ReturnType<typeof transcriptPassages>;
}

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
    if (current?.deleted === true) {
      throw new ApiError("not_found", "That conversation was deleted");
    }
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
    const reservation = await reserveChatMessage(usage, { askedAt, accountId, plan, dailyMessages }, log);

    const settings = await readSettings(records, accountId);
    const reader = settings === null ? null : composeReaderContext(settings.aboutYou, settings.learned);
    const othersInPrompt = otherChatsInPrompt(others);
    const othersText = otherChatsPrompt(kind, othersInPrompt);
    const history = conversation?.messages ?? [];
    let sources: OtherSourcesTurn;
    try {
      sources = caller.acrossSources ? await this.#otherSources(accountId, overview, question, history, log) : NO_OTHER_SOURCES;
    } catch (error) {
      await usage.release(reservation.day, accountId);
      throw error;
    }
    const sourcesBlock = (turn: number): PromptMessage[] => {
      const block = sources.inPrompt.blocks[turn] ?? null;
      return block === null ? [] : [{ role: "user", content: block }];
    };
    let readerTurn = 0;
    const prompt: PromptMessage[] = [
      {
        role: "system",
        content: chatSystemPrompt(kind, overviewMarkdown(overview, { partIds: true }), passages, {
          recipe: overview.recipe !== null,
          reader,
        }),
      },
      ...(othersText === null ? [] : [{ role: "user" as const, content: othersText }]),
      ...history.flatMap((message): PromptMessage[] =>
        message.from === "reader"
          ? [...sourcesBlock(readerTurn++), { role: "user", content: message.text }]
          : [{ role: "assistant", content: message.text }],
      ),
      ...sourcesBlock(readerTurn),
      { role: "user", content: question.text },
    ];
    const logged = {
      plan,
      about: kind,
      model: chatModel.model,
      otherChatMessages: othersInPrompt.messages,
      personalised: reader !== null,
      searched: sources.searched,
      pinnedSources: sources.added.filter((source) => source.how === "pinned").length,
      foundSources: sources.added.filter((source) => source.how === "found").length,
      briefSources: sources.added.filter((source) => source.brief === true).length,
      setAsideSources: sources.setAside.length,
      keywordMinutes: sources.minutes.reduce((total, each) => total + each.passages.length, 0),
    };
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
        if (sources.added.length > 0) {
          yield {
            type: "sources",
            pinned: sources.added.filter((source) => source.how === "pinned"),
            found: sources.added.filter((source) => source.how === "found"),
          };
        }
        const cite = (ids: readonly string[], inSource: boolean) =>
          citationsOf(
            citedIds(ids, inSource),
            passages,
            overviewParts(overview),
            othersInPrompt.labels,
            sources.inPrompt.labels,
            sources.inPrompt.minuteLabels,
          );
        let sectionsSent = 0;
        for await (const piece of stream.pieces) {
          raw += piece;
          const text = outsideCode(answerSoFar(raw, "intro"), (prose) =>
            withoutDashes(withoutCitationMarks(prose, { arriving: true })),
          ).trimEnd();
          if (text.length > sent.length && text.startsWith(sent)) {
            yield { type: "text", text: text.slice(sent.length) };
            sent = text;
          }
          const arrived = arrivedSections(raw, sectionsSent);
          sectionsSent = arrived.seen;
          // A passage cited before inSource is known shows as a moment; the stored answer settles it.
          const shown = structuredAnswer(
            { intro: "", introSources: [], sections: arrived.sections, takeaway: "" },
            (ids) => cite(ids, true).citations,
          ).sections;
          for (const section of shown) {
            yield { type: "section", section };
          }
        }
        assertWhole(stream);
        const reply = ChatReply.parse(JSON.parse(raw));
        const answerSections = structuredAnswer(reply, (ids) => cite(ids, reply.inSource).citations);
        const text = flattenedAnswer(answerSections);
        if (text.length === 0) {
          throw new EmptyAnswerError("the reply had no answer");
        }
        const cited = cite(allIds(reply), reply.inSource);
        const messages: ChatMessage[] = [
          {
            from: "reader",
            text: question.text,
            at: askedAt.toISOString(),
            ...(sources.added.length === 0 ? {} : { sources: sources.added }),
            ...(sources.setAside.length === 0 ? {} : { setAside: sources.setAside }),
            ...(question.searchLibrary ? {} : { searchedLibrary: false as const }),
            ...(sources.minutes.length === 0
              ? {}
              : {
                  minutes: sources.minutes.map(({ overviewId: id, passages: sent }) => ({
                    overviewId: id,
                    passages: sent.map((passage) => passage.id),
                  })),
                }),
          },
          {
            from: "answer",
            text,
            at: clock().toISOString(),
            citations: cited.citations,
            inSource: cited.inSource,
            sections: answerSections,
          },
        ];
        const written = await appendChatMessages(
          records,
          accountId,
          { owner: { kind: "overview", id: overviewId }, conversationId: question.conversationId, messages },
          clock(),
        );
        settled = true;
        const cost = await this.#recordCost(accountId, stream.usage(), "message", log);
        const usageUnits = chatUnitsOf(cost.costDollars ?? 0);
        await usage.settle(reservation.day, accountId, usageUnits);
        log.info(
          apiLogLines.chat.answered({
            ...logged,
            ...cost,
            usageUnits,
            inSource: cited.inSource,
            generalKnowledge: reply.generalKnowledge,
            sourceCitations: cited.sourceCitations,
            overviewCitations: cited.overviewCitations,
            chatCitations: cited.chatCitations,
            otherOverviewCitations: cited.otherOverviewCitations,
            minuteCitations: cited.minuteCitations,
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

  // The other overviews this conversation has held, question by question, and what this question
  // adds or sets aside. Each source keeps its label, so earlier questions' blocks rebuild exactly.
  async #otherSources(
    accountId: AccountId,
    home: Overview,
    question: ChatQuestionRequest,
    history: readonly ChatMessage[],
    log: FastifyBaseLogger,
  ): Promise<OtherSourcesTurn> {
    const { records, meaningSearch, passages, transcripts } = this.#options;
    const overviewId = home.id;
    const asked = history.flatMap((message) => (message.from === "reader" ? [message] : []));
    const past: SourcesTurn[] = asked.map((message) => ({ sources: message.sources ?? [], setAside: message.setAside ?? [] }));
    const all = past.flatMap((turn) => turn.sources);
    const wasSetAside = new Set(past.flatMap((turn) => turn.setAside));
    const live = all.filter((source) => !wasSetAside.has(source.label));
    const setAside = live.filter((source) => question.setAside.includes(source.overviewId)).map((source) => source.label);
    const stillLive = live.filter((source) => !setAside.includes(source.label));
    const inConversation = new Set(stillLive.map((source) => source.overviewId));
    // Search my library off (OV-354): only what the reader pinned is read.
    const searching = question.searchLibrary;
    const choice = await chooseOtherSources(records, searching ? meaningSearch : null, {
      accountId,
      home: overviewId,
      question,
      inConversation,
      setAside: new Set(all.map((source) => source.overviewId).filter((id) => !inConversation.has(id))),
      nextLabel: Math.max(0, ...all.map((source) => Number(source.label.slice(1)))) + 1,
    });
    // OV-352: the 8 best minutes for the question's words, each with its neighbours, searched only in
    // the overviews this question reads: pinned, found or already in the conversation. Words alone
    // never add an overview, since a shared word says nothing about relevance (OV-362).
    const added = choice.added;
    const sources = [...all, ...added];
    const overviews = await this.#overviewsOf(
      accountId,
      sources.map((source) => source.overviewId),
    );
    const reading = [...stillLive, ...added].flatMap((source) => {
      const overview = overviews.get(source.overviewId);
      const key = overview === undefined ? null : sourceKey(overview.source);
      return key === null ? [] : [key];
    });
    const found =
      passages === null || !searching || reading.length === 0
        ? []
        : await keywordMinutes({ passages, records }, accountId, question.text, { within: reading }, log);
    const minutes = found.map((each) => ({ overviewId: each.overviewId, passages: each.passages }));
    const earlier = asked.flatMap((message) => message.minutes ?? []);
    const cut =
      earlier.length === 0
        ? new Map<string, Passage[]>()
        : await transcriptMinutes(
            transcripts,
            accountId,
            [...new Set(earlier.map((each) => each.overviewId))].flatMap((id) => overviews.get(id) ?? []),
          );
    const pastWithMinutes = past.map((turn, index) => ({
      ...turn,
      minutes: (asked[index]!.minutes ?? []).map(({ overviewId: id, passages: ids }) => ({
        overviewId: id,
        passages: (cut.get(id) ?? []).filter((passage) => ids.includes(passage.id)),
      })),
    }));
    const projectIds = [...new Set(sources.flatMap((source) => (source.projectId === undefined ? [] : [source.projectId])))];
    const projects = new Map(
      (await records.readLive(accountId, "project", projectIds)).flatMap((record) => {
        const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Project, PROJECT_MIGRATIONS);
        return read.status === "read" ? [[read.record.id as string, read.record] as const] : [];
      }),
    );
    return {
      added,
      setAside,
      minutes,
      searched: choice.searched,
      inPrompt: otherSourcesInPrompt([...pastWithMinutes, { sources: added, setAside, minutes }], overviews, projects),
    };
  }

  async #overviewsOf(accountId: AccountId, ids: readonly string[]): Promise<Map<string, Overview>> {
    const rows = await this.#options.records.readLive(accountId, "overview", [...new Set(ids)]);
    return new Map(
      rows.flatMap((record) => {
        const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
        return read.status === "read" ? [[read.record.id as string, read.record] as const] : [];
      }),
    );
  }

  async #overview(accountId: AccountId, overviewId: string): Promise<Overview> {
    const record = await this.#options.records.read(accountId, "overview", overviewId);
    if (record === null || record.deleted) {
      throw new ApiError("not_found", "No such overview");
    }
    const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
    if (read.status !== "read") {
      throw new ApiError("not_found", "No such overview");
    }
    return read.record;
  }

  // Only what the account holds itself: no transcript, no chat, and the panel hides
  // (docs/features/chats.md, "No transcript, no chat").
  async #source(accountId: AccountId, overview: Overview): Promise<SourcePassages> {
    const { source } = overview;
    const kind = chatSourceKind(overview);
    // An article or a recipe page is answered from its overview alone: no page text is kept (OV-320).
    if (answeredFromOverviewAlone(kind) || source.kind === "web") {
      return { kind, passages: [] };
    }
    const key = sourceKey(source);
    const stored = key === null ? null : StoredTranscript.safeParse(await this.#options.transcripts.get(accountId, key));
    const passages = stored?.success === true ? transcriptPassages(stored.data.segments) : [];
    if (passages.length === 0) {
      throw new ApiError("transcript_unavailable", "There's no transcript kept for this overview to answer from", { chat: "no-source" });
    }
    return { kind, passages };
  }

  #recordCost(accountId: AccountId, usage: TokenUsage | null, detail: string, log: FastifyBaseLogger): Promise<ChatCost> {
    return recordChatCost(this.#options, accountId, usage, detail, log);
  }
}
