import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import {
  apiLogLines,
  Chat,
  CHAT_MIGRATIONS,
  chatQuestionCount,
  chatRecordId,
  isInProject,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CHAT_PICKS,
  MAX_CHAT_QUESTIONS,
  Overview,
  OVERVIEW_MIGRATIONS,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  Project,
  ProjectMember,
  readStoredRecord,
  stampSchemaVersion,
  type ChatAnswerSections,
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
import type { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { answerSoFar } from "./answerSoFar.js";
import { appendChatMessages } from "./appendChatMessages.js";
import { assertWhole, CHAT_FAILED, EmptyAnswerError, reasonOf, statusOf } from "./chatFailure.js";
import { chatModel } from "./chatModel.js";
import { overviewCitationsOf, type CitableOverview } from "./citationsOf.js";
import {
  libraryChatMaterial,
  PICK_SHAPE,
  PickReply,
  pickedBlock,
  pickPrompt,
  SECTIONED_SHAPE,
  SectionedReply,
  SectionedSection,
  type LibraryChatScope,
} from "./libraryChatPrompt.js";
import { recordChatCost } from "./recordChatCost.js";
import { reserveChatMessage } from "./reserveChatMessage.js";
import { sectionsSoFar } from "./sectionsSoFar.js";
import { streamChatCompletion, type ChatCompletionStream, type PromptMessage, type ReplyShape } from "./streamChatCompletion.js";
import { withoutCitationMarks } from "./withoutCitationMarks.js";

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
}

export type LibraryChatOwner = Exclude<ChatOwner, { kind: "overview" }>;

function readAll<T>(rows: readonly StoredRecord[], schema: z.ZodType<T>, migrations: readonly RecordMigration[]): T[] {
  return rows.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schemaVersion), schema, migrations);
    return read.status === "read" ? [read.record] : [];
  });
}

type SectionedSection = z.infer<typeof SectionedSection>;

const cleaned = (text: string) => withoutCitationMarks(text, { library: true });

// The answer as one text: what copy, a hand-off, MCP and the next question's history read.
const flattened = (sections: ChatAnswerSections): string =>
  [
    sections.intro,
    ...sections.sections.map((section) => [section.heading, ...section.points.map((point) => `- ${point.text}`)].join("\n")),
    sections.takeaway,
  ]
    .filter((part) => part.trim() !== "")
    .join("\n\n")
    .slice(0, MAX_CHAT_MESSAGE_LENGTH);

// Answers a reader's question over their whole library or one project, on our key, within the
// same allowance as an overview's chat. Small enough, the overviews go whole and one pass answers;
// larger, the model picks up to five from the map and code sends those whole for a second pass
// (OV-307's measured two-pass shape; docs/features/chats.md, "Library and project chat").
export class LibraryChatAnswerer {
  #options: LibraryChatAnswererOptions;

  constructor(options: LibraryChatAnswererOptions) {
    this.#options = options;
  }

  async ask(
    { accountId, plan }: { accountId: AccountId; plan: Plan },
    owner: LibraryChatOwner,
    question: { conversationId: string; text: string },
    log: FastifyBaseLogger,
  ): Promise<AsyncGenerator<ChatStreamEvent>> {
    const { records, usage, clock, dailyMessages } = this.#options;
    const { scope, overviews, stats } = await this.#scope(accountId, owner);
    if (overviews.length === 0) {
      throw new ApiError("transcript_unavailable", "There are no overviews here to answer from yet", { chat: "no-source" });
    }
    const id = chatRecordId(owner, question.conversationId);
    const current = await records.read(accountId, "chat", id);
    if (current?.deleted === true) throw new ApiError("not_found", "That conversation was deleted");
    const conversation = current === null ? null : (readAll([current], Chat, CHAT_MIGRATIONS)[0] ?? null);
    if (conversation !== null && chatQuestionCount(conversation.messages) >= MAX_CHAT_QUESTIONS) {
      throw new ApiError("invalid_request", "This conversation is as long as it can get. Start a new one to keep asking.", {
        conversation: "full",
      });
    }

    const askedAt = clock();
    const reservation = await reserveChatMessage(usage, { askedAt, accountId, plan, dailyMessages }, log);
    const release = () => usage.release(reservation.day, accountId);

    const material = libraryChatMaterial(scope, overviews, this.#options.wholeCharacters);
    const labelOf = new Map([...material.labels].map(([label, overview]) => [overview.id as string, label]));
    const history = conversation?.messages ?? [];
    const readBefore = new Set(history.flatMap((message) => (message.from === "reader" ? (message.picked ?? []) : [])));
    const block = (picked: readonly string[]): PromptMessage[] => {
      const entries = picked.flatMap((overviewId) => {
        const label = labelOf.get(overviewId);
        const overview = label === undefined ? undefined : material.labels.get(label);
        return label === undefined || overview === undefined ? [] : [[label, overview] as const];
      });
      return entries.length === 0 ? [] : [pickedBlock(entries)];
    };
    const before: PromptMessage[] = [
      { role: "system", content: material.system },
      ...history.flatMap((message): PromptMessage[] =>
        message.from === "reader"
          ? [...block(message.picked ?? []), { role: "user", content: message.text }]
          : [{ role: "assistant", content: message.text }],
      ),
    ];
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
      let stream: ChatCompletionStream | null = null;
      let settled = false;
      try {
        let picked: OverviewId[] = [];
        if (material.mode === "map") {
          yield { type: "picking" };
          const pick = await ask([...before, pickPrompt(question.text)], PICK_SHAPE);
          let raw = "";
          for await (const piece of pick.pieces) raw += piece;
          pickUsage = pick.usage();
          assertWhole(pick);
          const labels = PickReply.parse(JSON.parse(raw)).overviews.map((label) => label.split(".")[0] ?? "");
          picked = [...new Set(labels)]
            .flatMap((label) => {
              const overview = material.labels.get(label);
              return overview === undefined || readBefore.has(overview.id) ? [] : [overview.id as OverviewId];
            })
            .slice(0, MAX_CHAT_PICKS);
          yield {
            type: "picked",
            overviews: picked.map((overviewId) => ({ overviewId, title: material.labels.get(labelOf.get(overviewId)!)!.source.title })),
          };
        }

        const readWhole = new Set<string>([...readBefore, ...picked]);
        const citable = new Map<string, CitableOverview>(
          [...material.labels].map(([label, overview]) => [
            label,
            {
              overviewId: overview.id as OverviewId,
              title: overview.source.title,
              overview,
              ...(material.mode === "map" && !readWhole.has(overview.id) ? { brief: true } : {}),
            },
          ]),
        );
        const sectionOf = (section: SectionedSection): ChatAnswerSections["sections"][number] => ({
          heading: cleaned(section.heading),
          points: section.points.map((point) => ({ text: cleaned(point.text), citations: overviewCitationsOf(point.sources, citable) })),
        });

        stream = await ask([...before, ...block(picked), { role: "user", content: question.text }], SECTIONED_SHAPE);
        let raw = "";
        let sent = "";
        let sectionsSent = 0;
        for await (const piece of stream.pieces) {
          raw += piece;
          const intro = withoutCitationMarks(answerSoFar(raw, "intro"), { arriving: true, library: true });
          if (intro.length > sent.length && intro.startsWith(sent)) {
            yield { type: "text", text: intro.slice(sent.length) };
            sent = intro;
          }
          const whole = sectionsSoFar(raw);
          for (; sectionsSent < whole.length; sectionsSent += 1) {
            const section = SectionedSection.safeParse(whole[sectionsSent]);
            if (section.success) yield { type: "section", section: sectionOf(section.data) };
          }
        }
        assertWhole(stream);
        const reply = SectionedReply.parse(JSON.parse(raw));
        const sections: ChatAnswerSections = {
          intro: cleaned(reply.intro),
          sections: reply.sections.map(sectionOf),
          takeaway: cleaned(reply.takeaway),
        };
        const text = flattened(sections);
        if (text.length === 0) throw new EmptyAnswerError("the reply had no answer");
        const citations = uniqueCitations(sections.sections.flatMap((section) => section.points.flatMap((point) => point.citations)));
        const messages: ChatMessage[] = [
          { from: "reader", text: question.text, at: askedAt.toISOString(), ...(picked.length === 0 ? {} : { picked }) },
          { from: "answer", text, at: clock().toISOString(), citations, inSource: false, sections, stats },
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
            sections: sections.sections.length,
            points: sections.sections.reduce((total, section) => total + section.points.length, 0),
            otherOverviewCitations: citations.length,
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

  // The overviews a question is over, oldest saved first so a new save lands at the end of the
  // cached map, and the counts its answer shows, worked out here.
  async #scope(
    accountId: AccountId,
    owner: LibraryChatOwner,
  ): Promise<{ scope: LibraryChatScope; overviews: Overview[]; stats: ChatScopeStats }> {
    const { records } = this.#options;
    const oldestFirst = (overviews: Overview[]) => [...overviews].sort((left, right) => left.savedAt.localeCompare(right.savedAt));
    if (owner.kind === "library") {
      const overviews = readAll(await records.listLive(accountId, "overview", "%"), Overview, OVERVIEW_MIGRATIONS);
      const projects = (await records.listLiveIds(accountId, "project", "%")).length;
      return { scope: { kind: "library" }, overviews: oldestFirst(overviews), stats: { overviews: overviews.length, projects } };
    }
    const project = readAll(await records.readLive(accountId, "project", [owner.id]), Project, PROJECT_MIGRATIONS)[0];
    if (project === undefined) throw new ApiError("not_found", "No such project");
    const members = readAll(await records.listLive(accountId, "projectMember", `${project.id}:%`), ProjectMember, PROJECT_MEMBER_MIGRATIONS)
      .filter(isInProject)
      .map((member) => member.overviewId);
    const overviews = readAll(await records.readLive(accountId, "overview", members), Overview, OVERVIEW_MIGRATIONS);
    return { scope: { kind: "project", project }, overviews: oldestFirst(overviews), stats: { overviews: overviews.length } };
  }
}

// An overview cited by several points is one citation of each place, and of the whole only once.
function uniqueCitations(citations: readonly OtherOverviewCitation[]): OtherOverviewCitation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.overviewId}:${citation.item === null ? "" : `${citation.item.part}:${citation.item.index}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
