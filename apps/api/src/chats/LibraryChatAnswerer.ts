import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import {
  apiLogLines,
  Chat,
  CHAT_MIGRATIONS,
  chatQuestionCount,
  chatRecordId,
  isInProject,
  MAX_CHAT_PICKS,
  MAX_CHAT_QUESTIONS,
  Overview,
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  OverviewState,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  Project,
  ProjectMember,
  readStoredRecord,
  sourceKey,
  stampSchemaVersion,
  Topic,
  TOPIC_MIGRATIONS,
  type ChatSource,
  type ChatCitation,
  type ChatMessage,
  type ChatOwner,
  type ChatScopeStats,
  type ChatStreamEvent,
  type OtherOverviewCitation,
  type OverviewId,
  type Plan,
  type RecordMigration,
} from "@overview/domain";
import type { TokenUsage } from "@overview/generation";
import type { z } from "zod";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { ApiError } from "../http/ApiError.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import type { TranscriptPassagesRepository } from "../transcripts/TranscriptPassagesRepository.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import type { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { answerSoFar } from "./answerSoFar.js";
import { appendChatMessages } from "./appendChatMessages.js";
import { assertWhole, CHAT_FAILED, EmptyAnswerError, reasonOf, statusOf } from "./chatFailure.js";
import { chatModel } from "./chatModel.js";
import { overviewCitationsOf, type CitableOverview } from "./citationsOf.js";
import { keywordMinutes, transcriptMinutes } from "./keywordMinutes.js";
import { PINNED_PROJECT_WHOLE } from "./chooseOtherSources.js";
import {
  BROAD_SHAPE,
  libraryChatMaterial,
  marksBlock,
  minutesBlock,
  pickedBlock,
  PLAN_SHAPE,
  planPrompt,
  scopeBlock,
  SECTIONED_SHAPE,
  type LibraryChatScope,
} from "./libraryChatPrompt.js";
import { ChatPlan, planScope, type OverviewMarks } from "./planScope.js";
import { recordChatCost } from "./recordChatCost.js";
import { reserveChatMessage } from "./reserveChatMessage.js";
import { arrivedSections } from "./arrivedSections.js";
import { streamChatCompletion, type ChatCompletionStream, type PromptMessage, type ReplyShape } from "./streamChatCompletion.js";
import type { Passage } from "./transcriptPassages.js";
import { withoutCitationMarks } from "./withoutCitationMarks.js";
import { ChatReply, type ChatReplySection } from "./ChatReply.js";
import { outsideCode } from "./outsideCode.js";
import { flattenedAnswer, structuredAnswer, withoutDashes } from "./structuredAnswer.js";

export interface LibraryChatAnswererOptions {
  apiKey: string;
  http: typeof fetch;
  dailyMessages: number;
  records: RecordsRepository;
  usage: ChatUsageRepository;
  costs: AccountCostsRepository;
  clock: () => Date;
  sleep?: (ms: number) => Promise<void>;
  wholeCharacters?: number;
  // A large project's keyword minutes (OV-352); without them, none are sent.
  passages?: TranscriptPassagesRepository | null;
  transcripts?: TranscriptsRepository | null;
}

export type LibraryChatOwner = Exclude<ChatOwner, { kind: "overview" }>;

const readAll = <T>(rows: readonly StoredRecord[], schema: z.ZodType<T>, migrations: readonly RecordMigration[]): T[] => {
  return rows.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schemaVersion), schema, migrations);
    return read.status === "read" ? [read.record] : [];
  });
};

export interface AskAccount {
  accountId: AccountId;
  plan: Plan;
}

export interface LibraryQuestion {
  conversationId: string;
  text: string;
  pins?: { overviews: readonly string[]; projects: readonly string[] };
  setAside?: readonly string[];
}

export interface OverviewPassages {
  overviewId: string;
  passages: readonly Passage[];
}

export interface Pins {
  overviews: readonly string[];
  projects: readonly string[];
}

export interface ResolvedScope {
  scope: LibraryChatScope;
  overviews: Overview[];
  stats: ChatScopeStats;
  marks: Map<string, OverviewMarks>;
  topics: string[];
}

// Answers a reader's question over their whole library or one project, on our key, within the
// same allowance as an overview's chat. Small enough, the overviews go whole and one pass answers;
// larger, the model plans from the map: filters code applies, a mode, and up to five picks code sends
// whole for a second pass (OV-373; docs/features/chats.md, "Library and project chat").
export class LibraryChatAnswerer {
  #options: LibraryChatAnswererOptions;

  constructor(options: LibraryChatAnswererOptions) {
    this.#options = options;
  }

  async ask(
    { accountId, plan }: AskAccount,
    owner: LibraryChatOwner,
    question: LibraryQuestion,
    log: FastifyBaseLogger,
  ): Promise<AsyncGenerator<ChatStreamEvent>> {
    const { records, usage, clock, dailyMessages } = this.#options;
    const { scope, overviews, stats, marks, topics } = await this.#scope(accountId, owner);
    if (overviews.length === 0) {
      throw new ApiError("transcript_unavailable", "There are no overviews here to answer from yet", { chat: "no-source" });
    }
    const id = chatRecordId(owner, question.conversationId);
    const current = await records.read(accountId, "chat", id);
    if (current?.deleted === true) {
      throw new ApiError("not_found", "That conversation was deleted");
    }
    const conversation = current === null ? null : (readAll([current], Chat, CHAT_MIGRATIONS)[0] ?? null);
    if (conversation !== null && chatQuestionCount(conversation.messages) >= MAX_CHAT_QUESTIONS) {
      throw new ApiError("invalid_request", "This conversation is as long as it can get. Start a new one to keep asking.", {
        conversation: "full",
      });
    }

    const askedAt = clock();
    const reservation = await reserveChatMessage(usage, { askedAt, accountId, plan, dailyMessages }, log);
    const release = () => usage.release(reservation.day, accountId);

    const material = libraryChatMaterial(scope, overviews, this.#options.wholeCharacters, { marks, topics });
    const marksMessage = marksBlock(material.labels, marks);
    const history = conversation?.messages ?? [];
    const asked = history.flatMap((message) => (message.from === "reader" ? [message] : []));
    // Pins (OV-354): what the reader added with "@" is read whole with that question, beside the
    // picks. One outside the project gets a label after the map's, fixed for the conversation.
    const pastSources = asked.flatMap((message) => message.sources ?? []);
    const wasSetAside = new Set(asked.flatMap((message) => message.setAside ?? []));
    const pinnedNow = await this.#pinned(accountId, question.pins ?? { overviews: [], projects: [] });
    const labels = new Map(material.labels);
    const labelOf = new Map([...labels].map(([label, overview]) => [overview.id as string, label]));
    const outside = await this.#overviewsOf(
      accountId,
      pastSources.map((source) => source.overviewId).filter((id) => !labelOf.has(id)),
    );
    for (const overview of [...outside, ...pinnedNow]) {
      if (labelOf.has(overview.id)) {
        continue;
      }
      const label = `O${labels.size + 1}`;
      labels.set(label, overview);
      labelOf.set(overview.id, label);
    }
    const setAsideNow = pastSources.filter(
      (source) => !wasSetAside.has(source.label) && (question.setAside ?? []).includes(source.overviewId),
    );
    const setAsideIds = new Set<string>([
      ...pastSources.filter((source) => wasSetAside.has(source.label)).map((source) => source.overviewId),
      ...setAsideNow.map((source) => source.overviewId),
    ]);
    const readBefore = new Set<string>([
      ...asked.flatMap((message) => message.picked ?? []),
      ...pastSources.filter((source) => !setAsideIds.has(source.overviewId)).map((source) => source.overviewId),
    ]);
    const pinnedNew = pinnedNow.filter((overview) => !readBefore.has(overview.id));
    const nextS = Math.max(0, ...pastSources.map((source) => Number(source.label.slice(1)))) + 1;
    const pinnedSources: ChatSource[] = pinnedNew.map((overview, index) => ({
      label: `S${nextS + index}`,
      overviewId: overview.id as OverviewId,
      title: overview.source.title,
      how: "pinned",
    }));
    const setAsideLine = (named: readonly ChatSource[]): PromptMessage[] =>
      named.length === 0
        ? []
        : [
            {
              role: "user",
              content: `The reader set aside ${named.map((source) => `"${source.title}"`).join(", ")} from this conversation. Don't use or cite ${named.length === 1 ? "it" : "them"} from here on.`,
            },
          ];
    const block = (picked: readonly string[]): PromptMessage[] => {
      const entries = picked.flatMap((overviewId) => {
        const label = labelOf.get(overviewId);
        const overview = label === undefined ? undefined : labels.get(label);
        return label === undefined || overview === undefined ? [] : [[label, overview] as const];
      });
      return entries.length === 0 ? [] : [pickedBlock(entries)];
    };
    const minuteLabels = new Map<string, OtherOverviewCitation>();
    const minutesMessage = (minutes: ReadonlyArray<OverviewPassages>): PromptMessage[] => {
      const entries = minutes.flatMap(({ overviewId, passages }) => {
        const label = labelOf.get(overviewId);
        const overview = label === undefined ? undefined : labels.get(label);
        if (label === undefined || overview === undefined || passages.length === 0) {
          return [];
        }
        for (const passage of passages) {
          minuteLabels.set(`${label}.${passage.id}`, {
            overviewId: overview.id as OverviewId,
            title: overview.source.title,
            item: null,
            range: { startMs: passage.startMs, endMs: passage.endMs },
          });
        }
        return [[label, overview, passages] as const];
      });
      return entries.length === 0 ? [] : [minutesBlock(entries)];
    };
    const earlier = history.flatMap((message) => (message.from === "reader" ? (message.minutes ?? []) : []));
    const cut =
      earlier.length === 0 || this.#options.transcripts == null
        ? new Map<string, Passage[]>()
        : await transcriptMinutes(
            this.#options.transcripts,
            accountId,
            overviews.filter((overview) => earlier.some((each) => each.overviewId === overview.id)),
          );
    const before: PromptMessage[] = [
      { role: "system", content: material.system },
      ...history.flatMap((message): PromptMessage[] =>
        message.from === "reader"
          ? [
              ...block([...(message.sources ?? []).map((source) => source.overviewId), ...(message.picked ?? [])]),
              ...setAsideLine(pastSources.filter((source) => (message.setAside ?? []).includes(source.label))),
              ...minutesMessage(
                (message.minutes ?? []).map(({ overviewId, passages: ids }) => ({
                  overviewId,
                  passages: (cut.get(overviewId) ?? []).filter((passage) => ids.includes(passage.id)),
                })),
              ),
              { role: "user", content: message.text },
            ]
          : [{ role: "assistant", content: message.text }],
      ),
    ];
    const memberKeys = overviews.flatMap((overview) => sourceKey(overview.source) ?? []);
    const { passages: passageIndex } = this.#options;
    const cacheKey = `chat-${owner.kind === "project" ? `project-${owner.id}` : `library-${createHash("sha256").update(accountId).digest("hex").slice(0, 16)}`}`;
    const startedAt = askedAt.getTime();
    const logged = { plan, owner: owner.kind, mode: material.mode, model: chatModel.model, overviewsInScope: overviews.length };
    const setup = {
      apiKey: this.#options.apiKey,
      http: this.#options.http,
      sleep: this.#options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
      retried: (status: number) => log.info(apiLogLines.chat.retried({ status })),
    };
    const ask = (messages: readonly PromptMessage[], shape: ReplyShape) => streamChatCompletion(setup, messages, cacheKey, shape);
    const options = this.#options;

    const answer = async function* (): AsyncGenerator<ChatStreamEvent> {
      let pickUsage: TokenUsage | null = null;
      let keywordMinuteCount = 0;
      let sentMinutes: Array<{ overviewId: OverviewId; passages: string[] }> = [];
      let stream: ChatCompletionStream | null = null;
      let settled = false;
      try {
        let picked: OverviewId[] = [];
        let broad = material.mode === "whole";
        let filtered = false;
        let kept = [...material.labels.keys()];
        let looked: number | undefined;
        if (material.mode === "map") {
          yield { type: "picking" };
          const planned = await ask([...before, marksMessage, planPrompt(question.text)], PLAN_SHAPE);
          let raw = "";
          for await (const piece of planned.pieces) {
            raw += piece;
          }
          pickUsage = planned.usage();
          assertWhole(planned);
          const plan = ChatPlan.parse(JSON.parse(raw));
          const scoped = planScope(plan.filters, material.labels, marks);
          broad = plan.mode === "broad";
          filtered = scoped.filtered;
          kept = scoped.kept;
          looked = kept.length;
          const inScope = new Set(kept);
          picked = [...new Set(plan.picks.map((label) => label.split(".")[0] ?? ""))]
            .flatMap((label) => {
              const overview = material.labels.get(label);
              return overview === undefined ||
                !inScope.has(label) ||
                readBefore.has(overview.id) ||
                pinnedNew.some((pin) => pin.id === overview.id)
                ? []
                : [overview.id as OverviewId];
            })
            .slice(0, MAX_CHAT_PICKS);
          yield {
            type: "picked",
            overviews: picked.map((overviewId) => ({ overviewId, title: material.labels.get(labelOf.get(overviewId)!)!.source.title })),
            looked,
          };
        }

        const readWhole = new Set<string>([...readBefore, ...picked, ...pinnedNew.map((overview) => overview.id)]);
        const citable = new Map<string, CitableOverview>(
          [...labels]
            .filter(([, overview]) => !setAsideIds.has(overview.id))
            .map(([label, overview]) => [
              label,
              {
                overviewId: overview.id as OverviewId,
                title: overview.source.title,
                overview,
                ...(material.mode === "map" && !readWhole.has(overview.id) ? { brief: true } : {}),
              },
            ]),
        );
        // An overview's id or item (O3, O3.kp2), or a minute of its transcript (O3.p14).
        const cite = (ids: readonly string[]): ChatCitation[] => [
          ...overviewCitationsOf(
            ids.filter((id) => !/\.p\d+$/.test(id)),
            citable,
          ),
          ...[...new Set(ids)].flatMap((id) => minuteLabels.get(id) ?? []),
        ];
        const sectionOf = (section: ChatReplySection) =>
          structuredAnswer({ intro: "", introSources: [], sections: [section], takeaway: "" }, cite, { library: true }).sections[0]!;

        // OV-352: a large project also sends the 8 best minutes of its members' transcripts.
        const found =
          material.mode === "map" && owner.kind === "project" && passageIndex != null
            ? await keywordMinutes({ passages: passageIndex, records }, accountId, question.text, { within: memberKeys }, log)
            : [];
        const minutes = found.map((each) => ({ overviewId: each.overviewId, passages: each.passages }));
        keywordMinuteCount = minutes.reduce((total, each) => total + each.passages.length, 0);
        sentMinutes = minutes.map(({ overviewId, passages: sent }) => ({ overviewId, passages: sent.map((passage) => passage.id) }));
        stream = await ask(
          [
            ...before,
            marksMessage,
            ...(filtered ? [scopeBlock(kept)] : []),
            ...block([...pinnedNew.map((overview) => overview.id), ...picked]),
            ...minutesMessage(minutes),
            ...setAsideLine(setAsideNow),
            { role: "user", content: question.text },
          ],
          broad ? BROAD_SHAPE : SECTIONED_SHAPE,
        );
        let raw = "";
        let sent = "";
        let sectionsSent = 0;
        for await (const piece of stream.pieces) {
          raw += piece;
          const intro = outsideCode(answerSoFar(raw, "intro"), (prose) =>
            withoutDashes(withoutCitationMarks(prose, { arriving: true, library: true })),
          ).trimEnd();
          if (intro.length > sent.length && intro.startsWith(sent)) {
            yield { type: "text", text: intro.slice(sent.length) };
            sent = intro;
          }
          const arrived = arrivedSections(raw, sectionsSent);
          sectionsSent = arrived.seen;
          for (const section of arrived.sections) {
            yield { type: "section", section: sectionOf(section) };
          }
        }
        assertWhole(stream);
        const reply = ChatReply.parse(JSON.parse(raw));
        const sections = structuredAnswer(reply, cite, { library: true });
        const text = flattenedAnswer(sections);
        if (text.length === 0) {
          throw new EmptyAnswerError("the reply had no answer");
        }
        const citations = uniqueCitations(
          [...sections.introSources, ...sections.sections.flatMap((section) => section.sources)].map((source) => source.citation),
        );
        const messages: ChatMessage[] = [
          {
            from: "reader",
            text: question.text,
            at: askedAt.toISOString(),
            ...(picked.length === 0 ? {} : { picked }),
            ...(pinnedSources.length === 0 ? {} : { sources: pinnedSources }),
            ...(setAsideNow.length === 0 ? {} : { setAside: setAsideNow.map((source) => source.label) }),
            ...(sentMinutes.length === 0 ? {} : { minutes: sentMinutes }),
          },
          {
            from: "answer",
            text,
            at: clock().toISOString(),
            citations,
            inSource: false,
            sections,
            stats: {
              ...stats,
              read: material.mode === "whole" ? overviews.length : picked.length + pinnedNew.length,
              ...(looked === undefined ? {} : { looked }),
            },
          },
        ];
        const written = await appendChatMessages(records, accountId, { owner, conversationId: question.conversationId, messages }, clock());
        settled = true;
        const pickCost = await recordChatCost(options, accountId, pickUsage, "pick", log);
        const cost = await recordChatCost(options, accountId, stream.usage(), "message", log);
        log.info(
          apiLogLines.chat.answered({
            ...logged,
            ...cost,
            costDollars: cost.costDollars === null ? null : cost.costDollars + (pickCost.costDollars ?? 0),
            pickInputTokens: pickCost.inputTokens,
            pickOutputTokens: pickCost.outputTokens,
            picked: picked.length,
            answerMode: broad ? "broad" : "deep",
            filtered,
            lookedAcross: looked ?? null,
            scopeCited: new Set(
              citations.flatMap((citation) =>
                "overviewId" in citation && kept.some((label) => material.labels.get(label)?.id === citation.overviewId)
                  ? [citation.overviewId]
                  : [],
              ),
            ).size,
            sections: sections.sections.length,
            sourcesCited: citations.length,
            otherOverviewCitations: citations.length,
            keywordMinutes: keywordMinuteCount,
            minuteCitations: citations.filter((citation) => "overviewId" in citation && citation.range !== undefined).length,
            inSource: false,
            used: reservation.used,
            limit: reservation.limit,
            ms: clock().getTime() - startedAt,
          }),
        );
        yield { type: "answered", chatId: id, rev: written.rev, messages };
      } catch (error) {
        settled = true;
        await release();
        const pickCost = await recordChatCost(options, accountId, pickUsage, "pick-failed", log);
        const cost = await recordChatCost(options, accountId, stream?.usage() ?? null, "message-failed", log);
        log.warn(
          apiLogLines.chat.failed({
            ...logged,
            ...cost,
            pickInputTokens: pickCost.inputTokens,
            reason: reasonOf(error),
            status: statusOf(error),
            ms: clock().getTime() - startedAt,
          }),
        );
        yield { type: "failed", message: CHAT_FAILED };
      } finally {
        // The reader stopped, or went, before the answer was stored: as an overview's chat does.
        if (!settled) {
          await stream?.pieces.return(undefined);
          await release();
          log.info(apiLogLines.chat.stopped({ ...logged, ms: clock().getTime() - startedAt }));
        }
      }
    };
    return answer();
  }

  // What the reader pinned: overviews, and a project's members, the most recently added 8 of a large
  // one, as an overview's chat caps them. Only live ones.
  async #pinned(accountId: AccountId, pins: Pins): Promise<Overview[]> {
    const { records } = this.#options;
    const members: string[] = [];
    for (const project of readAll(await records.readLive(accountId, "project", pins.projects), Project, PROJECT_MIGRATIONS)) {
      members.push(
        ...readAll(await records.listLive(accountId, "projectMember", `${project.id}:%`), ProjectMember, PROJECT_MEMBER_MIGRATIONS)
          .filter(isInProject)
          .sort((left, right) => right.addedAt.localeCompare(left.addedAt))
          .slice(0, PINNED_PROJECT_WHOLE)
          .map((member) => member.overviewId),
      );
    }
    const ids = [...new Set([...pins.overviews, ...members])];
    const found = new Map((await this.#overviewsOf(accountId, ids)).map((overview) => [overview.id as string, overview]));
    return ids.flatMap((id) => found.get(id) ?? []);
  }

  async #overviewsOf(accountId: AccountId, ids: readonly string[]): Promise<Overview[]> {
    return ids.length === 0
      ? []
      : readAll(await this.#options.records.readLive(accountId, "overview", [...new Set(ids)]), Overview, OVERVIEW_MIGRATIONS);
  }

  // The overviews a question is over, oldest saved first so a new save lands at the end of the
  // cached map, and the counts its answer shows, worked out here.
  async #scope(accountId: AccountId, owner: LibraryChatOwner): Promise<ResolvedScope> {
    const { records } = this.#options;
    const oldestFirst = (overviews: Overview[]) => [...overviews].sort((left, right) => left.savedAt.localeCompare(right.savedAt));
    const allTopics = readAll(await records.listLive(accountId, "topic", "%"), Topic, TOPIC_MIGRATIONS);
    const states = new Map(
      readAll(await records.listLive(accountId, "overviewState", "%"), OverviewState, OVERVIEW_STATE_MIGRATIONS).map((state) => [
        state.overviewId as string,
        state,
      ]),
    );
    const marksOf = (overviews: readonly Overview[]) =>
      new Map(
        overviews.map((overview) => [
          overview.id as string,
          {
            read: states.get(overview.id)?.read ?? false,
            favourite: states.get(overview.id)?.favourite ?? false,
            topics: overview.topicIds.flatMap((topicId) => allTopics.find((topic) => topic.id === topicId)?.name ?? []),
          },
        ]),
      );
    const topicNames = (overviews: readonly Overview[]) =>
      [...new Set(overviews.flatMap((overview) => marksOf([overview]).get(overview.id)!.topics))].sort((left, right) =>
        left.localeCompare(right),
      );
    if (owner.kind === "library") {
      const overviews = readAll(await records.listLive(accountId, "overview", "%"), Overview, OVERVIEW_MIGRATIONS);
      const projects = (await records.listLiveIds(accountId, "project", "%")).length;
      return {
        scope: { kind: "library" },
        overviews: oldestFirst(overviews),
        stats: { overviews: overviews.length, projects },
        marks: marksOf(overviews),
        topics: topicNames(overviews),
      };
    }
    const project = readAll(await records.readLive(accountId, "project", [owner.id]), Project, PROJECT_MIGRATIONS)[0];
    if (project === undefined) {
      throw new ApiError("not_found", "No such project");
    }
    const members = readAll(await records.listLive(accountId, "projectMember", `${project.id}:%`), ProjectMember, PROJECT_MEMBER_MIGRATIONS)
      .filter(isInProject)
      .map((member) => member.overviewId);
    const overviews = readAll(await records.readLive(accountId, "overview", members), Overview, OVERVIEW_MIGRATIONS);
    return {
      scope: { kind: "project", project },
      overviews: oldestFirst(overviews),
      stats: { overviews: overviews.length },
      marks: marksOf(overviews),
      topics: topicNames(overviews),
    };
  }
}

// An overview cited by several points is one citation of each place, and of the whole only once.
const uniqueCitations = (citations: readonly ChatCitation[]): ChatCitation[] => {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = JSON.stringify(citation);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
