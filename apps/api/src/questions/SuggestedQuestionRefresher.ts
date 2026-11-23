import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import {
  apiLogLines,
  composeReaderContext,
  isInProject,
  Project,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  ProjectMember,
  readStoredRecord,
  stampSchemaVersion,
  SUGGESTED_QUESTION_MIGRATIONS,
  SuggestedQuestion,
  SuggestedQuestionText,
  type Plan,
  type RecordMigration,
  type SuggestedQuestionRefreshStatus,
  type SuggestedQuestionScope,
} from "@overview/domain";
import type { TokenUsage } from "@overview/generation";
import type { z } from "zod";
import type { AccountId } from "../auth/AccountId.js";
import type { ChatCompletionSetup, PromptMessage, ReplyShape } from "../chats/streamChatCompletion.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import type { SqlClient } from "../db/SqlClient.js";
import { readSettings } from "../records/readSettings.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import { allocateQuestionSlots, isUsedUp, NEW_QUESTIONS_PER_REFRESH, scopeKeyOf, type ScopeSlots } from "./allocateQuestionSlots.js";
import { askClaudeForJson } from "./askClaudeForJson.js";
import { askForJson, UnreadableReplyError } from "./askForJson.js";
import { ClaimPairsRepository } from "./ClaimPairsRepository.js";
import { compactNote, LABEL_PROMPT, PAIR_LABEL_SHAPE, PairLabel, pairNotes, TENSIONS } from "./PairLabel.js";
import { libraryCandidates, pairKeyOf, projectCandidates, readOverviews, type QuestionCandidate } from "./questionCandidates.js";
import { QUESTION_LABEL_MODEL, QUESTION_WRITER_MODEL } from "./questionModels.js";
import { askedPairKey, QuestionRefreshesRepository, type RefreshOutcome } from "./QuestionRefreshesRepository.js";
import { questionWriterPrompt, WRITTEN_QUESTIONS_SHAPE, WrittenQuestions } from "./questionWriterPrompt.js";
import { recordQuestionCost } from "./recordQuestionCost.js";
import { writeSuggestedQuestions, type NewSuggestedQuestion } from "./writeSuggestedQuestions.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const QUESTION_PLANS: ReadonlySet<Plan> = new Set(["byo-plus", "plus"]);
export const REFRESHES_PER_WINDOW = 3;
export const REFRESH_WINDOW_DAYS = 7;
export const REFRESH_GAP_DAYS = 2;
export const REFRESH_STALE_MINUTES = 15;
export const QUESTIONS_MONTHLY_CAP_DOLLARS = 0.4;
export const LIBRARY_PAIRS_LABELLED = 8;
export const PROJECT_PAIRS_LABELLED = 4;
export const SPARE_PAIRS_PER_SCOPE = 1;
export const PROJECT_MEMBERS_MIN = 2;
export const OBVIOUS_EXAMPLES = 4;

export interface SuggestedQuestionRefresherOptions {
  apiKey: string;
  anthropicApiKey: string;
  http: typeof fetch;
  sql: SqlClient;
  records: RecordsRepository;
  costs: AccountCostsRepository;
  embeddingModel: string;
  planOf: (accountId: AccountId) => Promise<Plan>;
  clock: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface RefreshResult {
  outcome: RefreshOutcome;
  scopes: string[];
  pairsLabelled: number;
  questionsWritten: number;
}

export interface RefreshStart {
  status: SuggestedQuestionRefreshStatus;
  // Never rejects: a failure is logged and the refresh marked failed.
  finished: Promise<RefreshResult | null>;
}

interface EligibleProject {
  scope: SuggestedQuestionScope;
  project: Project;
  members: string[];
}

interface QuestionCall<T> {
  model: { provider: "openai" | "anthropic"; model: string };
  shape: Omit<ReplyShape, "model">;
  schema: z.ZodType<T>;
  detail: string;
}

export interface LabelledPair {
  slots: ScopeSlots;
  candidate: QuestionCandidate;
  label: PairLabel;
}

const readAll = <T>(rows: readonly StoredRecord[], schema: z.ZodType<T>, migrations: readonly RecordMigration[]): T[] =>
  rows.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schemaVersion), schema, migrations);
    return read.status === "read" ? [read.record] : [];
  });

const NEW_SENTENCE = /[.?!]\s+\S/;

export const isOneSentence = (text: string): boolean => !NEW_SENTENCE.test(text.trim());

const projectLine = (project: Project) => `- ${project.name}${project.purpose === null ? "" : `: ${project.purpose}`}`;

const withTensionsFirst = (pairs: readonly LabelledPair[]): LabelledPair[] =>
  [...pairs].sort((x, y) => Number(TENSIONS.has(y.label.relation)) - Number(TENSIONS.has(x.label.relation)));

// The refresh and its rules: docs/features/suggested-questions.md, "Slice 2: the refresh".
export class SuggestedQuestionRefresher {
  #options: SuggestedQuestionRefresherOptions;
  #refreshes: QuestionRefreshesRepository;
  #claimPairs: ClaimPairsRepository;
  #running = new Set<Promise<RefreshResult | null>>();

  constructor(options: SuggestedQuestionRefresherOptions) {
    this.#options = options;
    this.#refreshes = new QuestionRefreshesRepository(options.sql);
    this.#claimPairs = new ClaimPairsRepository(options.sql);
  }

  async refresh(accountId: AccountId, scope: SuggestedQuestionScope, log: FastifyBaseLogger): Promise<RefreshStart> {
    const { planOf, costs, clock } = this.#options;
    const plan = await planOf(accountId);
    const stopped = (status: SuggestedQuestionRefreshStatus): RefreshStart => {
      log.info(apiLogLines.questions.refreshed({ plan, status }));
      return { status, finished: Promise.resolve(null) };
    };
    if (!QUESTION_PLANS.has(plan)) {
      return stopped("free");
    }
    const now = clock();
    await this.#refreshes.opened(accountId, scopeKeyOf(scope), now);
    if ((await costs.monthDollars(accountId, "questions", now)) >= QUESTIONS_MONTHLY_CAP_DOLLARS) {
      return stopped("capped");
    }
    const begun = await this.#refreshes.begin(accountId, {
      now,
      windowStart: new Date(now.getTime() - REFRESH_WINDOW_DAYS * DAY_MS),
      perWindow: REFRESHES_PER_WINDOW,
      latestAllowed: new Date(now.getTime() - REFRESH_GAP_DAYS * DAY_MS),
      staleBefore: new Date(now.getTime() - REFRESH_STALE_MINUTES * 60 * 1000),
    });
    if ("refused" in begun) {
      return stopped(begun.refused);
    }
    const finished = this.#run(accountId, begun.id, plan, log);
    this.#running.add(finished);
    void finished.then(() => this.#running.delete(finished));
    return { status: "started", finished };
  }

  async drain(): Promise<void> {
    await Promise.all([...this.#running]);
  }

  async #run(accountId: AccountId, refreshId: string, plan: Plan, log: FastifyBaseLogger): Promise<RefreshResult | null> {
    const progress: RefreshResult = { outcome: "failed", scopes: [], pairsLabelled: 0, questionsWritten: 0 };
    try {
      Object.assign(progress, await this.#fill(accountId, progress, log));
      await this.#refreshes.finish(refreshId, this.#options.clock(), progress);
      log.info(
        apiLogLines.questions.refreshed({
          plan,
          status: "started",
          outcome: progress.outcome,
          library: progress.scopes.includes("library"),
          projects: progress.scopes.filter((key) => key !== "library").length,
          pairsLabelled: progress.pairsLabelled,
          questionsWritten: progress.questionsWritten,
        }),
      );
      return progress;
    } catch (error) {
      log.warn(
        apiLogLines.questions.refreshFailed({
          reason: error instanceof Error ? error.constructor.name : "unknown",
          pairsLabelled: progress.pairsLabelled,
        }),
      );
      await this.#refreshes.finish(refreshId, this.#options.clock(), { ...progress, outcome: "failed" }).catch(() => undefined);
      return null;
    }
  }

  async #fill(accountId: AccountId, progress: RefreshResult, log: FastifyBaseLogger): Promise<RefreshResult> {
    const { records, clock } = this.#options;
    const now = clock();
    const questions = readAll(
      await records.listLive(accountId, "suggestedQuestion", "%"),
      SuggestedQuestion,
      SUGGESTED_QUESTION_MIGRATIONS,
    );
    const projects = await this.#eligibleProjects(accountId);
    const allocated = allocateQuestionSlots(
      questions,
      projects.map((each) => each.scope),
      now,
    );
    progress.scopes = allocated.map((slots) => slots.scopeKey);
    if (allocated.length === 0) {
      return { ...progress, outcome: "full" };
    }

    const asked = await this.#refreshes.askedPairs(accountId);
    const sources = { claimPairs: this.#claimPairs, records, model: this.#options.embeddingModel };
    const toLabel: Array<{ slots: ScopeSlots; candidate: QuestionCandidate }> = [];
    for (const slots of allocated) {
      const project = projects.find((each) => scopeKeyOf(each.scope) === slots.scopeKey);
      const candidates =
        project === undefined ? await libraryCandidates(sources, accountId) : await projectCandidates(sources, accountId, project.members);
      const limit = project === undefined ? LIBRARY_PAIRS_LABELLED : PROJECT_PAIRS_LABELLED;
      const fresh = candidates.filter((candidate) => !asked.has(askedPairKey(slots.scopeKey, [candidate.first, candidate.second])));
      toLabel.push(...fresh.slice(0, limit).map((candidate) => ({ slots, candidate })));
    }
    if (toLabel.length === 0) {
      return { ...progress, outcome: "no-pairs" };
    }

    const overviews = await readOverviews(
      records,
      accountId,
      toLabel.flatMap(({ candidate }) => [candidate.first, candidate.second]),
    );
    const settings = await readSettings(records, accountId);
    const reader = settings === null ? null : composeReaderContext(settings.aboutYou, settings.learned);
    const allProjects = readAll(await records.listLive(accountId, "project", "%"), Project, PROJECT_MIGRATIONS).filter(
      (project) => project.archivedAt === null,
    );
    const readerBlock = [
      `# About the reader\n${reader ?? "Nothing is known about this reader."}`,
      allProjects.length === 0 ? "" : `# Projects they are working on\n${allProjects.map(projectLine).join("\n")}`,
    ]
      .filter((part) => part !== "")
      .join("\n\n");

    const labellable = toLabel.filter(({ candidate }) => overviews.has(candidate.first) && overviews.has(candidate.second));
    progress.pairsLabelled = labellable.length;
    const labelled = await Promise.all(
      labellable.map(async ({ slots, candidate }) => {
        const project = projects.find((each) => scopeKeyOf(each.scope) === slots.scopeKey)?.project;
        const context =
          project === undefined
            ? readerBlock
            : `${readerBlock}\n\n# This is for the project "${project.name}"${project.purpose === null ? "" : `: ${project.purpose}`}`;
        const label = await this.#ask(
          accountId,
          [
            { role: "system", content: LABEL_PROMPT },
            { role: "user", content: `${context}\n\n${pairNotes(overviews.get(candidate.first)!, overviews.get(candidate.second)!)}` },
          ],
          { model: QUESTION_LABEL_MODEL, shape: PAIR_LABEL_SHAPE, schema: PairLabel, detail: "label" },
          log,
        ).catch(() => null);
        return label === null ? [] : [{ slots, candidate, label }];
      }),
    );
    const kept = allocated.flatMap((slots) =>
      withTensionsFirst(labelled.flat().filter((pair) => pair.slots === slots && pair.label.verdict === "real")).slice(
        0,
        slots.slots + SPARE_PAIRS_PER_SCOPE,
      ),
    );
    if (kept.length === 0) {
      return { ...progress, outcome: "no-pairs" };
    }

    const scopeKeys = new Set(allocated.map((slots) => slots.scopeKey));
    const obvious = questions
      .filter((question) => question.feedback?.verdict === "obvious")
      .sort((x, y) => y.feedback!.at.localeCompare(x.feedback!.at))
      .slice(0, OBVIOUS_EXAMPLES)
      .map((question) => question.text);
    const onShow = questions
      .filter((question) => scopeKeys.has(scopeKeyOf(question.scope)) && !isUsedUp(question, now))
      .map((question) => question.text);
    const projectsNow = projects.filter((each) => scopeKeys.has(scopeKeyOf(each.scope))).map((each) => each.project);
    const placeOf = (slots: ScopeSlots) => {
      const project = projects.find((each) => scopeKeyOf(each.scope) === slots.scopeKey)?.project;
      const name = project === undefined ? "the whole library" : `the project "${project.name}"`;
      return `${name}, which can take ${slots.slots}`;
    };
    const pairsText = kept
      .map(
        ({ slots, candidate, label }, index) =>
          `## Pair ${index + 1}, for ${placeOf(slots)} (${label.relation.replace(/_/g, " ")})\n- A: ${compactNote(overviews.get(candidate.first)!, candidate.firstPosition)}\n- B: ${compactNote(overviews.get(candidate.second)!, candidate.secondPosition)}`,
      )
      .join("\n\n");
    const roundProjects = projectsNow.length === 0 ? "" : `# Projects in this round\n${projectsNow.map(projectLine).join("\n")}\n\n`;
    const written = await this.#ask(
      accountId,
      [
        { role: "system", content: questionWriterPrompt({ obvious, onShow }) },
        { role: "user", content: `${readerBlock}\n\n${roundProjects}${pairsText}` },
      ],
      { model: QUESTION_WRITER_MODEL, shape: WRITTEN_QUESTIONS_SHAPE, schema: WrittenQuestions, detail: "write" },
      log,
    );

    const outcomes = await writeSuggestedQuestions(records, accountId, keptQuestions(written, kept), clock());
    return { ...progress, outcome: "written", questionsWritten: outcomes.filter((outcome) => outcome !== null).length };
  }

  async #eligibleProjects(accountId: AccountId): Promise<EligibleProject[]> {
    const { records } = this.#options;
    const opened = await this.#refreshes.openedProjects(accountId);
    if (opened.length === 0) {
      return [];
    }
    const projects = readAll(
      await records.readLive(
        accountId,
        "project",
        opened.map((each) => each.projectId),
      ),
      Project,
      PROJECT_MIGRATIONS,
    );
    const eligible: EligibleProject[] = [];
    for (const { projectId } of opened) {
      const project = projects.find((each) => each.id === projectId);
      if (project === undefined || project.archivedAt !== null) {
        continue;
      }
      const members = readAll(
        await records.listLive(accountId, "projectMember", `${projectId}:%`),
        ProjectMember,
        PROJECT_MEMBER_MIGRATIONS,
      )
        .filter(isInProject)
        .sort((x, y) => y.addedAt.localeCompare(x.addedAt))
        .map((member) => member.overviewId as string);
      const live = new Set((await records.readLive(accountId, "overview", members)).map((row) => row.id));
      const liveMembers = members.filter((id) => live.has(id));
      if (liveMembers.length >= PROJECT_MEMBERS_MIN) {
        eligible.push({ scope: { kind: "project", projectId: project.id }, project, members: liveMembers });
      }
    }
    return eligible;
  }

  async #ask<T>(accountId: AccountId, messages: readonly PromptMessage[], call: QuestionCall<T>, log: FastifyBaseLogger): Promise<T> {
    const { apiKey, anthropicApiKey, http, sleep } = this.#options;
    const setup: ChatCompletionSetup = {
      apiKey,
      http,
      sleep: sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
      retried: (status: number) => log.info(apiLogLines.chat.retried({ status })),
    };
    const shape = { ...call.shape, model: call.model.model };
    const cacheKey = `questions-${createHash("sha256").update(accountId).digest("hex").slice(0, 16)}`;
    const record = (usage: TokenUsage | null, detail: string) =>
      recordQuestionCost(this.#options, accountId, call.model, usage, detail, log);
    try {
      const reply =
        call.model.provider === "anthropic"
          ? await askClaudeForJson({ ...setup, apiKey: anthropicApiKey }, messages, shape, call.schema)
          : await askForJson(setup, messages, cacheKey, shape, call.schema);
      await record(reply.usage, call.detail);
      return reply.value;
    } catch (error) {
      await record(error instanceof UnreadableReplyError ? error.usage : null, `${call.detail}-failed`);
      throw error;
    }
  }
}

// Code keeps only what the record and the round allow: docs/features/suggested-questions.md, "Writing".
export const keptQuestions = (written: WrittenQuestions, kept: readonly LabelledPair[]): NewSuggestedQuestion[] => {
  const taken = new Map<ScopeSlots, number>();
  const usedPairs = new Set<string>();
  const out: NewSuggestedQuestion[] = [];
  for (const { pair, question } of written.questions) {
    const row = Number.isInteger(pair) ? kept[pair - 1] : undefined;
    const text = question.trim();
    if (
      row === undefined ||
      out.length >= NEW_QUESTIONS_PER_REFRESH ||
      !SuggestedQuestionText.safeParse(text).success ||
      !isOneSentence(text)
    ) {
      continue;
    }
    const pairKey = `${row.slots.scopeKey}|${pairKeyOf(row.candidate)}`;
    const count = taken.get(row.slots) ?? 0;
    if (usedPairs.has(pairKey) || count >= row.slots.slots) {
      continue;
    }
    usedPairs.add(pairKey);
    taken.set(row.slots, count + 1);
    out.push({ scope: row.slots.scope, overviewIds: [row.candidate.first, row.candidate.second], text });
  }
  return out;
};
