import {
  CURRENT_SCHEMA_VERSIONS,
  SUGGESTED_QUESTION_MIGRATIONS,
  SuggestedQuestion,
  SuggestedQuestionChange,
  isSuggestedQuestionLive,
  mergeSuggestedQuestion,
  migrateStoredRecord,
  readStoredRecord,
  stampStoredRecord,
  type SuggestedQuestionScope,
  type SuggestedQuestionStore,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { QUESTIONS_BY_PROJECT_INDEX, SUGGESTED_QUESTIONS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

const readable = (raw: unknown): SuggestedQuestion[] => {
  const read = readStoredRecord(raw, SuggestedQuestion, SUGGESTED_QUESTION_MIGRATIONS);
  return read.status === "read" ? [read.record] : [];
};

const OUTCOME_FIELDS = ["shownAt", "askedAt", "dismissedAt", "feedback"] as const;

const outcomesOf = (record: Record<string, unknown>): string => JSON.stringify(OUTCOME_FIELDS.map((field) => record[field] ?? null));

const inScope = (scope: SuggestedQuestionScope) => (question: SuggestedQuestion) =>
  scope.kind === "library" ? question.scope.kind === "library" : question.scope.kind === "project";

// A device records only what became of one: docs/features/suggested-questions.md, "On the device".
export class IndexedDbSuggestedQuestionStore implements SuggestedQuestionStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  // The library's questions have no project, so no index holds them.
  async listSuggestedQuestions(scope: SuggestedQuestionScope): Promise<SuggestedQuestion[]> {
    const store = this.#db.transaction(SUGGESTED_QUESTIONS_STORE, "readonly").objectStore(SUGGESTED_QUESTIONS_STORE);
    const request = scope.kind === "project" ? store.index(QUESTIONS_BY_PROJECT_INDEX).getAll(scope.projectId) : store.getAll();
    const questions = (await promisifyRequest<unknown[]>(request)).flatMap(readable).filter(inScope(scope)).filter(isSuggestedQuestionLive);
    return questions.sort((left, right) => right.madeAt.localeCompare(left.madeAt));
  }

  async getSuggestedQuestion(id: string): Promise<SuggestedQuestion | null> {
    const store = this.#db.transaction(SUGGESTED_QUESTIONS_STORE, "readonly").objectStore(SUGGESTED_QUESTIONS_STORE);
    const raw = await promisifyRequest<unknown>(store.get(id));
    return raw === undefined ? null : (readable(raw)[0] ?? null);
  }

  // Merged unparsed: docs/features/record-migrations.md, "Writes are field-scoped, not whole-record".
  async changeSuggestedQuestion(id: string, change: SuggestedQuestionChange): Promise<void> {
    const sent = SuggestedQuestionChange.parse(change);
    const now = new Date();
    const transaction = this.#db.transaction([SUGGESTED_QUESTIONS_STORE, ...JOURNALLED_STORES], "readwrite");
    const questions = transaction.objectStore(SUGGESTED_QUESTIONS_STORE);
    const migrated = migrateStoredRecord(await promisifyRequest<unknown>(questions.get(id)), SUGGESTED_QUESTION_MIGRATIONS);
    if (migrated.status !== "migrated") {
      await promisifyTransaction(transaction);
      return;
    }
    const merged = mergeSuggestedQuestion(migrated.record, sent);
    if (outcomesOf(merged) === outcomesOf(migrated.record)) {
      await promisifyTransaction(transaction);
      return;
    }
    questions.put(stampStoredRecord({ ...merged, id }, CURRENT_SCHEMA_VERSIONS.suggestedQuestion, now));
    const journaled = await appendPendingWrite(transaction, {
      kind: "suggestedQuestion",
      id,
      updatedAt: now.toISOString(),
      change: { op: "suggestedQuestion", change: sent },
    });
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }
}
