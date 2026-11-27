import {
  CURRENT_OVERVIEW_SCHEMA_VERSION,
  CURRENT_OVERVIEW_STATE_SCHEMA_VERSION,
  CURRENT_TOPIC_SCHEMA_VERSION,
  DEFAULT_OVERVIEW_STATE,
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  Overview,
  OverviewState,
  TOPIC_MIGRATIONS,
  Topic,
  TopicId,
  UnreadableRecordError,
  migrateStoredRecord,
  readStoredRecord,
  stampStoredRecord,
  unreadableRecord,
  type ClaimSummary,
  type OutboxChange,
  type OverviewId,
  type OverviewQuery,
  type OverviewStore,
  type PendingWrite,
  type RecordMigration,
  type Refiling,
  type TopicMerge,
  type TopicPatch,
  type TopicsFiled,
  addedOnMerge,
  editedTopic,
  refiledOnMerge,
  refiledOnRestore,
  restoreRequestOf,
  type StoredRecordRead,
  type SyncedRecordKind,
  type UnreadableRecord,
  type UnreadableRecordKind,
  sourceKey,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import { forgetSuggestedQuestions } from "./forgetSuggestedQuestions.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import {
  CHATS_BY_OVERVIEW_INDEX,
  CHATS_STORE,
  MEMBERS_BY_OVERVIEW_INDEX,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  PROJECT_MEMBERS_STORE,
  QUESTIONS_BY_OVERVIEW_INDEX,
  SUGGESTED_QUESTIONS_STORE,
  TOPICS_STORE,
  CAPTURES_STORE,
} from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";
import { storedRecordId } from "./storedRecordId.js";

export interface CreateTopicOptions {
  name: string;
  description?: string;
}

export class IndexedDbOverviewStore implements OverviewStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  async getOverview(id: OverviewId) {
    const raw = await this.#read(OVERVIEWS_STORE, id);
    if (raw === undefined) {
      return null;
    }
    const read = readStoredRecord(raw, Overview, OVERVIEW_MIGRATIONS);
    if (read.status === "unreadable") {
      throw new UnreadableRecordError(unreadableRecord("overview", id, read, raw));
    }
    return read.record;
  }

  async listOverviews(query: OverviewQuery = {}) {
    const raws = await this.#readAll(OVERVIEWS_STORE);
    const overviews = raws
      .map((raw) => readStoredRecord(raw, Overview, OVERVIEW_MIGRATIONS))
      .flatMap((read) => (read.status === "read" ? [read.record] : []));

    return overviews.filter((overview) => {
      if (query.unsorted) {
        return overview.topicIds.length === 0;
      }
      if (query.topicId) {
        return overview.topicIds.includes(query.topicId);
      }
      return true;
    });
  }

  async listUnreadable(): Promise<UnreadableRecord[]> {
    const [overviews, states, topics] = await Promise.all([
      this.#readAll(OVERVIEWS_STORE),
      this.#readAll(OVERVIEW_STATES_STORE),
      this.#readAll(TOPICS_STORE),
    ]);

    return [
      ...quarantined(overviews, "overview", "id", (raw) => readStoredRecord(raw, Overview, OVERVIEW_MIGRATIONS)),
      ...quarantined(states, "overviewState", "overviewId", (raw) =>
        readStoredRecord(withStateDefaults(raw), OverviewState, OVERVIEW_STATE_MIGRATIONS),
      ),
      ...quarantined(topics, "topic", "id", (raw) => readStoredRecord(raw, Topic, TOPIC_MIGRATIONS)),
    ];
  }

  // docs/features/transcript-storage.md, "Following the reader across devices".
  async saveOverview(overview: Overview) {
    const now = new Date();
    const record = stampStoredRecord(overview, CURRENT_OVERVIEW_SCHEMA_VERSION, now);
    const transaction = this.#db.transaction([OVERVIEWS_STORE, CAPTURES_STORE, ...JOURNALLED_STORES], "readwrite");
    transaction.objectStore(OVERVIEWS_STORE).put(record);
    transaction.objectStore(CAPTURES_STORE).delete(overview.id);
    const updatedAt = now.toISOString();
    const journaled = await appendPendingWrite(transaction, {
      kind: "overview",
      id: overview.id,
      updatedAt,
      change: { op: "replace", record },
    });
    const key = sourceKey(overview.source);
    // A page has no transcript: docs/features/transcript-storage.md, "Following the reader across devices".
    if (journaled && key !== null && overview.source.kind !== "web") {
      await appendPendingWrite(transaction, {
        kind: "transcript",
        id: key,
        updatedAt,
        change: { op: "transcript", overviewId: overview.id },
      });
    }
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }

  async setOverviewTopics(overviewId: OverviewId, topicIds: TopicId[]) {
    const raw = await this.#read(OVERVIEWS_STORE, overviewId);
    if (raw === undefined) {
      return;
    }
    const current = this.#writable("overview", overviewId, raw, OVERVIEW_MIGRATIONS);
    const now = new Date();
    await this.#write(
      OVERVIEWS_STORE,
      stampStoredRecord({ ...current, topicIds, editedAt: now.toISOString() }, CURRENT_OVERVIEW_SCHEMA_VERSION, now),
      "overview",
      overviewId,
      now,
      { op: "topics", topicIds, edited: true },
    );
  }

  async setOverviewCaptureReason(overviewId: OverviewId, captureReason: string | null) {
    const raw = await this.#read(OVERVIEWS_STORE, overviewId);
    if (raw === undefined) {
      return;
    }
    const current = this.#writable("overview", overviewId, raw, OVERVIEW_MIGRATIONS);
    const now = new Date();
    await this.#write(
      OVERVIEWS_STORE,
      stampStoredRecord({ ...current, captureReason, editedAt: now.toISOString() }, CURRENT_OVERVIEW_SCHEMA_VERSION, now),
      "overview",
      overviewId,
      now,
      { op: "captureReason", captureReason, edited: true },
    );
  }

  async setOverviewTags(overviewId: OverviewId, tags: string[]) {
    const raw = await this.#read(OVERVIEWS_STORE, overviewId);
    if (raw === undefined) {
      return;
    }
    const current = this.#writable("overview", overviewId, raw, OVERVIEW_MIGRATIONS);
    const now = new Date();
    await this.#write(
      OVERVIEWS_STORE,
      stampStoredRecord({ ...current, tags, editedAt: now.toISOString() }, CURRENT_OVERVIEW_SCHEMA_VERSION, now),
      "overview",
      overviewId,
      now,
      { op: "tags", tags, edited: true },
    );
  }

  // docs/features/sync-api.md, "Deletes are tombstones, and an overview takes its state with it".
  async deleteOverview(id: OverviewId) {
    const transaction = this.#db.transaction(
      [OVERVIEWS_STORE, OVERVIEW_STATES_STORE, PROJECT_MEMBERS_STORE, CHATS_STORE, SUGGESTED_QUESTIONS_STORE, ...JOURNALLED_STORES],
      "readwrite",
    );
    transaction.objectStore(OVERVIEWS_STORE).delete(id);
    transaction.objectStore(OVERVIEW_STATES_STORE).delete(id);
    const members = transaction.objectStore(PROJECT_MEMBERS_STORE);
    for (const key of await promisifyRequest<IDBValidKey[]>(members.index(MEMBERS_BY_OVERVIEW_INDEX).getAllKeys(id))) {
      members.delete(key);
    }
    const chats = transaction.objectStore(CHATS_STORE);
    for (const key of await promisifyRequest<IDBValidKey[]>(chats.index(CHATS_BY_OVERVIEW_INDEX).getAllKeys(id))) {
      chats.delete(key);
    }
    await forgetSuggestedQuestions(transaction, QUESTIONS_BY_OVERVIEW_INDEX, id);
    const journaled = await appendPendingWrite(transaction, {
      kind: "overview",
      id,
      updatedAt: new Date().toISOString(),
      change: { op: "delete" },
    });
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }

  async listClaims(): Promise<ClaimSummary[]> {
    const overviews = await this.listOverviews();
    return overviews.map((overview) => ({
      overviewId: overview.id,
      title: overview.source.title,
      claim: overview.coreClaim,
    }));
  }

  async listTopics() {
    const raws = await this.#readAll(TOPICS_STORE);
    return raws
      .map((raw) => readStoredRecord(raw, Topic, TOPIC_MIGRATIONS))
      .flatMap((read) => (read.status === "read" ? [read.record] : []));
  }

  async createTopic(input: CreateTopicOptions) {
    const now = new Date();
    const topic: Topic = {
      id: TopicId.parse(crypto.randomUUID()),
      name: input.name,
      description: input.description ?? null,
      createdAt: now.toISOString(),
    };
    const record = stampStoredRecord(topic, CURRENT_TOPIC_SCHEMA_VERSION, now);
    await this.#write(TOPICS_STORE, record, "topic", topic.id, now, { op: "replace", record });
    return topic;
  }

  async editTopic(id: TopicId, patch: TopicPatch) {
    const raw = await this.#read(TOPICS_STORE, id);
    const read = raw === undefined ? null : readStoredRecord(raw, Topic, TOPIC_MIGRATIONS);
    if (read === null || read.status === "unreadable" || Object.keys(patch).length === 0) {
      return;
    }
    const now = new Date();
    await this.#write(
      TOPICS_STORE,
      stampStoredRecord(editedTopic(read.record, patch), CURRENT_TOPIC_SCHEMA_VERSION, now),
      "topic",
      id,
      now,
      {
        op: "topic",
        patch: { ...patch },
      },
    );
  }

  async mergeTopic(from: TopicId, into: TopicId) {
    const topics = await this.listTopics();
    const topic = topics.find((candidate) => candidate.id === from);
    if (topic === undefined || from === into || !topics.some((candidate) => candidate.id === into)) {
      return null;
    }
    const filed = await this.#filed();
    const refilings = refiledOnMerge(filed, from, into);
    await this.#refileAndJournal(refilings, (topicsStore) => topicsStore.delete(from), {
      kind: "topic",
      id: from,
      change: { op: "mergeTopic", into },
    });
    return { topic, into, refiled: refilings.map(({ id }) => id), added: addedOnMerge(filed, from, into) };
  }

  async restoreTopic(merge: TopicMerge) {
    const now = new Date();
    const record = stampStoredRecord(merge.topic, CURRENT_TOPIC_SCHEMA_VERSION, now);
    await this.#refileAndJournal(refiledOnRestore(await this.#filed(), merge), (topicsStore) => topicsStore.put(record), {
      kind: "topic",
      id: merge.topic.id,
      change: { op: "restoreTopic", restore: restoreRequestOf(merge) },
    });
  }

  async deleteTopic(id: TopicId) {
    if (!(await this.listTopics()).some((topic) => topic.id === id)) {
      return;
    }
    await this.#refileAndJournal(refiledOnMerge(await this.#filed(), id, null), (topicsStore) => topicsStore.delete(id), {
      kind: "topic",
      id,
      change: { op: "delete" },
    });
  }

  async #filed(): Promise<TopicsFiled[]> {
    return (await this.listOverviews()).map(({ id, topicIds }) => ({ id, topicIds }));
  }

  async #refileAndJournal(
    refilings: readonly Refiling[],
    changeTopic: (topicsStore: IDBObjectStore) => void,
    write: Omit<PendingWrite, "updatedAt">,
  ): Promise<void> {
    const now = new Date();
    const transaction = this.#db.transaction([TOPICS_STORE, OVERVIEWS_STORE, ...JOURNALLED_STORES], "readwrite");
    const overviews = transaction.objectStore(OVERVIEWS_STORE);
    for (const { id, topicIds } of refilings) {
      const migrated = migrateStoredRecord(await promisifyRequest<unknown>(overviews.get(id)), OVERVIEW_MIGRATIONS);
      if (migrated.status === "migrated") {
        overviews.put(stampStoredRecord({ ...migrated.record, topicIds }, CURRENT_OVERVIEW_SCHEMA_VERSION, now));
      }
    }
    changeTopic(transaction.objectStore(TOPICS_STORE));
    const journaled = await appendPendingWrite(transaction, { ...write, updatedAt: now.toISOString() });
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }

  async getOverviewState(overviewId: OverviewId) {
    const raw = await this.#read(OVERVIEW_STATES_STORE, overviewId);
    const read = readStoredRecord({ ...withStateDefaults(raw), overviewId }, OverviewState, OVERVIEW_STATE_MIGRATIONS);
    return read.status === "read" ? read.record : { ...DEFAULT_OVERVIEW_STATE, overviewId };
  }

  async listOverviewStates() {
    const raws = await this.#readAll(OVERVIEW_STATES_STORE);
    return raws.flatMap((raw) => {
      const read = readStoredRecord(withStateDefaults(raw), OverviewState, OVERVIEW_STATE_MIGRATIONS);
      return read.status === "read" ? [read.record] : [];
    });
  }

  async setOverviewState(overviewId: OverviewId, patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags" | "asked">>) {
    const raw = await this.#read(OVERVIEW_STATES_STORE, overviewId);
    const current =
      raw === undefined
        ? { ...DEFAULT_OVERVIEW_STATE, overviewId }
        : this.#writable("overviewState", overviewId, raw, OVERVIEW_STATE_MIGRATIONS);

    const now = new Date();
    await this.#write(
      OVERVIEW_STATES_STORE,
      stampStoredRecord({ ...current, ...patch, overviewId }, CURRENT_OVERVIEW_STATE_SCHEMA_VERSION, now),
      "overviewState",
      overviewId,
      now,
      { op: "state", patch },
    );
  }

  // Merged unparsed: docs/features/record-migrations.md, "Writes are field-scoped, not whole-record".
  #writable(kind: "overview" | "overviewState", id: string, raw: unknown, migrations: readonly RecordMigration[]): Record<string, unknown> {
    const migrated = migrateStoredRecord(raw, migrations);
    if (migrated.status === "unreadable") {
      throw new UnreadableRecordError(unreadableRecord(kind, id, migrated, raw));
    }
    return migrated.record;
  }

  async #read(storeName: string, key: IDBValidKey): Promise<unknown> {
    const store = this.#db.transaction(storeName, "readonly").objectStore(storeName);
    return promisifyRequest<unknown>(store.get(key));
  }

  async #readAll(storeName: string): Promise<unknown[]> {
    const store = this.#db.transaction(storeName, "readonly").objectStore(storeName);
    return promisifyRequest<unknown[]>(store.getAll());
  }

  async #write(
    storeName: string,
    record: object,
    kind: SyncedRecordKind,
    id: string,
    writtenAt: Date,
    change: OutboxChange,
  ): Promise<void> {
    const transaction = this.#db.transaction([storeName, ...JOURNALLED_STORES], "readwrite");
    transaction.objectStore(storeName).put(record);
    const journaled = await appendPendingWrite(transaction, {
      kind,
      id,
      updatedAt: writtenAt.toISOString(),
      change,
    });
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }
}

const withStateDefaults = (raw: unknown): Record<string, unknown> => ({
  ...DEFAULT_OVERVIEW_STATE,
  ...(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}),
});

const quarantined = <T>(
  raws: unknown[],
  kind: UnreadableRecordKind,
  keyPath: string,
  read: (raw: unknown) => StoredRecordRead<T>,
): UnreadableRecord[] => {
  return raws.flatMap((raw) => {
    const result = read(raw);
    return result.status === "unreadable" ? [unreadableRecord(kind, storedRecordId(raw, keyPath), result, raw)] : [];
  });
};
