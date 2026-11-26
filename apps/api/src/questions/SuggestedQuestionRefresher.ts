import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import {
  SUGGESTED_QUESTION_PLANS,
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
  type Overview,
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
import { MIN_QUESTION_RATING, questionWriterPrompt, WRITTEN_QUESTIONS_SHAPE, WrittenQuestions } from "./questionWriterPrompt.js";
import { recordQuestionCost } from "./recordQuestionCost.js";
import { spreadAcrossTopics } from "./spreadAcrossTopics.js";
import { writeSuggestedQuestions, type NewSuggestedQuestion } from "./writeSuggestedQuestions.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const REFRESHES_PER_WINDOW = 3;
export const REFRESH_WINDOW_DAYS = 7;
export const REFRESH_GAP_DAYS = 2;
export const REFRESH_STALE_MINUTES = 15;
export const QUESTIONS_MONTHLY_CAP_DOLLARS = 0.4;
export const LIBRARY_PAIRS_LABELLED = 16;
export const PROJECT_PAIRS_LABELLED = 8;
export const PAIRS_TO_WRITER_PER_SLOT = 2;
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

export type DropReason = "badPair" | "textLimits" | "notOneSentence" | "lowRating" | "samePair" | "noRoom";

export interface RefreshFunnel {
  candidates: number;
  labelsReal: number;
  labelsStretch: number;
  labelsNotConnected: number;
  labelsFailed: number;
  pairsToWriter: number;
  writerReturned: number;
  dropped: Record<DropReason, number>;
  skippedOnWrite: number;
}

export interface RefreshResult {
  outcome: RefreshOutcome;
  scopes: string[];
  pairsLabelled: number;
  questionsWritten: number;
  funnel: RefreshFunnel;
}

const emptyFunnel = (): RefreshFunnel => ({
  candidates: 0,
  labelsReal: 0,
  labelsStretch: 0,
  labelsNotConnected: 0,
  labelsFailed: 0,
  pairsToWriter: 0,
  writerReturned: 0,
  dropped: { badPair: 0, textLimits: 0, notOneSentence: 0, lowRating: 0, samePair: 0, noRoom: 0 },
  skippedOnWrite: 0,
});

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
  topics: readonly string[];
}

const pairTopics = (overviews: ReadonlyMap<string, Overview>, ids: readonly string[]): string[] => [
  ...new Set(ids.flatMap((id) => overviews.get(id)?.topicIds ?? [])),
];

const readAll = <T>(rows: readonly StoredRecord[], schema: z.ZodType<T>, migrations: readonly RecordMigration[]): T[] =>
  rows.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body ?? {}, row.schemaVersion), schema, migrations);
    return read.status === "read" ? [read.record] : [];
  });

const NEW_SENTENCE = /[.?!]\s+\S/;

export const isOneSentence = (text: string): boolean => !NEW_SENTENCE.test(text.trim());

const projectLine = (project: Project) => `- ${project.name}${project.purpose === null ? "" : `: ${project.purpose}`}`;

const countLabel = (funnel: RefreshFunnel, label: PairLabel | null) => {
  if (label === null) {
    funnel.labelsFailed += 1;
  } else if (label.verdict === "real") {
    funnel.labelsReal += 1;
  } else if (label.verdict === "stretch") {
    funnel.labelsStretch += 1;
  } else {
    funnel.labelsNotConnected += 1;
  }
};

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
    if (!SUGGESTED_QUESTION_PLANS.has(plan)) {
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
    const progress: RefreshResult = { outcome: "failed", scopes: [], pairsLabelled: 0, questionsWritten: 0, funnel: emptyFunnel() };
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
          ...progress.funnel,
        }),
      );
      return progress;
    } catch (error) {
      log.warn(
        apiLogLines.questions.refreshFailed({
          reason: error instanceof Error ? error.constructor.name : "unknown",
          pairsLabelled: progress.pairsLabelled,
          ...progress.funnel,
        }),
      );
      await this.#refreshes.finish(refreshId, this.#options.clock(), { ...progress, outcome: "failed" }).catch(() => undefined);
      return null;
    }
  }

  async #fill(accountId: AccountId, progress: RefreshResult, log: FastifyBaseLogger): Promise<RefreshResult> {
    const { records, clock } = this.#options;
    const { funnel } = progress;
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
    const freshByScope: Array<{ slots: ScopeSlots; fresh: QuestionCandidate[] }> = [];
    for (const slots of allocated) {
      const project = projects.find((each) => scopeKeyOf(each.scope) === slots.scopeKey);
      const candidates =
        project === undefined ? await libraryCandidates(sources, accountId) : await projectCandidates(sources, accountId, project.members);
      const fresh = candidates.filter((candidate) => !asked.has(askedPairKey(slots.scopeKey, [candidate.first, candidate.second])));
      funnel.candidates += fresh.length;
      freshByScope.push({ slots, fresh });
    }

    const scopeKeys = new Set(allocated.map((slots) => slots.scopeKey));
    const onShowQuestions = questions.filter((question) => scopeKeys.has(scopeKeyOf(question.scope)) && !isUsedUp(question, now));
    const overviews = await readOverviews(records, accountId, [
      ...freshByScope.flatMap(({ fresh }) => fresh.flatMap((candidate) => [candidate.first, candidate.second])),
      ...onShowQuestions.flatMap((question) => question.overviewIds),
    ]);
    const coveredTopics = new Map(
      allocated.map((slots) => [
        slots.scopeKey,
        pairTopics(
          overviews,
          onShowQuestions.filter((question) => scopeKeyOf(question.scope) === slots.scopeKey).flatMap((question) => question.overviewIds),
        ),
      ]),
    );
    const candidateTopics = (candidate: QuestionCandidate) => pairTopics(overviews, [candidate.first, candidate.second]);
    const toLabel = freshByScope.flatMap(({ slots, fresh }) => {
      const limit = slots.scope.kind === "library" ? LIBRARY_PAIRS_LABELLED : PROJECT_PAIRS_LABELLED;
      const readable = fresh.filter((candidate) => overviews.has(candidate.first) && overviews.has(candidate.second));
      return spreadAcrossTopics(readable, candidateTopics, limit, coveredTopics.get(slots.scopeKey)).map((candidate) => ({
        slots,
        candidate,
      }));
    });
    if (toLabel.length === 0) {
      return { ...progress, outcome: "no-pairs" };
    }

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

    progress.pairsLabelled = toLabel.length;
    const labelled = await Promise.all(
      toLabel.map(async ({ slots, candidate }) => {
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
        countLabel(funnel, label);
        return label === null ? [] : [{ slots, candidate, label, topics: candidateTopics(candidate) }];
      }),
    );
    const kept = allocated.flatMap((slots) =>
      withTensionsFirst(labelled.flat().filter((pair) => pair.slots === slots && pair.label.verdict === "real")).slice(
        0,
        slots.slots * PAIRS_TO_WRITER_PER_SLOT,
      ),
    );
    funnel.pairsToWriter = kept.length;
    if (kept.length === 0) {
      return { ...progress, outcome: "no-pairs" };
    }

    const obvious = questions
      .filter((question) => question.feedback?.verdict === "obvious")
      .sort((x, y) => y.feedback!.at.localeCompare(x.feedback!.at))
      .slice(0, OBVIOUS_EXAMPLES)
      .map((question) => question.text);
    const onShow = onShowQuestions.map((question) => question.text);
    const projectsNow = projects.filter((each) => scopeKeys.has(scopeKeyOf(each.scope))).map((each) => each.project);
    const placeOf = (slots: ScopeSlots) => {
      const project = projects.find((each) => scopeKeyOf(each.scope) === slots.scopeKey)?.project;
      return project === undefined ? "the whole library" : `the project "${project.name}"`;
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

    funnel.writerReturned = written.questions.length;
    const { questions: toWrite, dropped } = keptQuestions(written, kept, coveredTopics);
    funnel.dropped = dropped;
    const outcomes = await writeSuggestedQuestions(records, accountId, toWrite, clock());
    const questionsWritten = outcomes.filter((outcome) => outcome !== null).length;
    funnel.skippedOnWrite = toWrite.length - questionsWritten;
    return { ...progress, outcome: "written", questionsWritten };
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
export interface KeptQuestions {
  questions: NewSuggestedQuestion[];
  dropped: Record<DropReason, number>;
}

interface Rated {
  row: LabelledPair;
  text: string;
  rating: number;
}

// Valid and rated well enough, best first, then spread across topics: docs/features/suggested-questions.md, "Writing".
export const keptQuestions = (
  written: WrittenQuestions,
  kept: readonly LabelledPair[],
  coveredTopics: ReadonlyMap<string, readonly string[]> = new Map(),
): KeptQuestions => {
  const dropped = emptyFunnel().dropped;
  const usedPairs = new Set<string>();
  const rated: Rated[] = [];
  const reasonToDrop = (row: LabelledPair, text: string, rating: number): DropReason | null => {
    if (!SuggestedQuestionText.safeParse(text).success) {
      return "textLimits";
    }
    if (!isOneSentence(text)) {
      return "notOneSentence";
    }
    if (!(rating >= MIN_QUESTION_RATING)) {
      return "lowRating";
    }
    if (usedPairs.has(`${row.slots.scopeKey}|${pairKeyOf(row.candidate)}`)) {
      return "samePair";
    }
    return null;
  };
  const bestFirst = [...written.questions].sort((x, y) => y.rating - x.rating);
  for (const { pair, question, rating } of bestFirst) {
    const row = Number.isInteger(pair) ? kept[pair - 1] : undefined;
    const text = question.trim();
    if (row === undefined) {
      dropped.badPair += 1;
      continue;
    }
    const reason = reasonToDrop(row, text, rating);
    if (reason !== null) {
      dropped[reason] += 1;
      continue;
    }
    usedPairs.add(`${row.slots.scopeKey}|${pairKeyOf(row.candidate)}`);
    rated.push({ row, text, rating });
  }

  const slotsInOrder = [...new Set(kept.map((row) => row.slots))];
  const out: NewSuggestedQuestion[] = [];
  for (const slots of slotsInOrder) {
    const room = Math.min(slots.slots, NEW_QUESTIONS_PER_REFRESH - out.length);
    const inScope = rated.filter((each) => each.row.slots === slots);
    const picked = spreadAcrossTopics(inScope, (each) => each.row.topics, room, coveredTopics.get(slots.scopeKey));
    dropped.noRoom += inScope.length - picked.length;
    out.push(
      ...picked.map(({ row, text }) => ({
        scope: row.slots.scope,
        overviewIds: [row.candidate.first, row.candidate.second] as const,
        text,
      })),
    );
  }
  return { questions: out, dropped };
};
