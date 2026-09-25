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
  type OverviewId,
  type OverviewQuery,
  type OverviewStore,
  type RecordMigration,
  type StoredRecordRead,
  type UnreadableRecord,
  type UnreadableRecordKind,
} from "@overview/domain";
import { OVERVIEWS_STORE, OVERVIEW_STATES_STORE, TOPICS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { storedRecordId } from "./storedRecordId.js";

export class IndexedDbOverviewStore implements OverviewStore {
  #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
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
      if (query.unsorted) return overview.topicIds.length === 0;
      if (query.topicId) return overview.topicIds.includes(query.topicId);
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
      ...quarantined(overviews, "overview", "id", (raw) =>
        readStoredRecord(raw, Overview, OVERVIEW_MIGRATIONS),
      ),
      ...quarantined(states, "overviewState", "overviewId", (raw) =>
        readStoredRecord(withStateDefaults(raw), OverviewState, OVERVIEW_STATE_MIGRATIONS),
      ),
      ...quarantined(topics, "topic", "id", (raw) =>
        readStoredRecord(raw, Topic, TOPIC_MIGRATIONS),
      ),
    ];
  }

  async saveOverview(overview: Overview) {
    await this.#write(OVERVIEWS_STORE, stampStoredRecord(overview, CURRENT_OVERVIEW_SCHEMA_VERSION));
  }

  async setOverviewTopics(overviewId: OverviewId, topicIds: TopicId[]) {
    const raw = await this.#read(OVERVIEWS_STORE, overviewId);
    if (raw === undefined) {
      return;
    }
    const current = this.#writable("overview", overviewId, raw, OVERVIEW_MIGRATIONS);
    await this.#write(
      OVERVIEWS_STORE,
      stampStoredRecord({ ...current, topicIds }, CURRENT_OVERVIEW_SCHEMA_VERSION),
    );
  }

  async setOverviewCaptureReason(overviewId: OverviewId, captureReason: string | null) {
    const raw = await this.#read(OVERVIEWS_STORE, overviewId);
    if (raw === undefined) {
      return;
    }
    const current = this.#writable("overview", overviewId, raw, OVERVIEW_MIGRATIONS);
    await this.#write(
      OVERVIEWS_STORE,
      stampStoredRecord({ ...current, captureReason }, CURRENT_OVERVIEW_SCHEMA_VERSION),
    );
  }

  async deleteOverview(id: OverviewId) {
    const store = this.#db.transaction(OVERVIEWS_STORE, "readwrite").objectStore(OVERVIEWS_STORE);
    await promisifyRequest(store.delete(id));
  }

  async listClaims(): Promise<ClaimSummary[]> {
    const overviews = await this.listOverviews();
    return overviews.map((overview) => ({
      overviewId: overview.id,
      title: overview.video.title,
      claim: overview.coreClaim,
    }));
  }

  async listTopics() {
    const raws = await this.#readAll(TOPICS_STORE);
    return raws
      .map((raw) => readStoredRecord(raw, Topic, TOPIC_MIGRATIONS))
      .flatMap((read) => (read.status === "read" ? [read.record] : []));
  }

  async createTopic(input: { name: string; description?: string }) {
    const topic: Topic = {
      id: TopicId.parse(crypto.randomUUID()),
      name: input.name,
      description: input.description ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.#write(TOPICS_STORE, stampStoredRecord(topic, CURRENT_TOPIC_SCHEMA_VERSION));
    return topic;
  }

  async getOverviewState(overviewId: OverviewId) {
    const raw = await this.#read(OVERVIEW_STATES_STORE, overviewId);
    const read = readStoredRecord(
      { ...withStateDefaults(raw), overviewId },
      OverviewState,
      OVERVIEW_STATE_MIGRATIONS,
    );
    return read.status === "read" ? read.record : { ...DEFAULT_OVERVIEW_STATE, overviewId };
  }

  async setOverviewState(
    overviewId: OverviewId,
    patch: Partial<Pick<OverviewState, "read" | "favourite" | "userTags">>,
  ) {
    const raw = await this.#read(OVERVIEW_STATES_STORE, overviewId);
    const current =
      raw === undefined
        ? { ...DEFAULT_OVERVIEW_STATE, overviewId }
        : this.#writable("overviewState", overviewId, raw, OVERVIEW_STATE_MIGRATIONS);

    await this.#write(
      OVERVIEW_STATES_STORE,
      stampStoredRecord(
        { ...current, ...patch, overviewId },
        CURRENT_OVERVIEW_STATE_SCHEMA_VERSION,
      ),
    );
  }

  // The patch is merged into the stored record rather than into a parsed one: zod strips
  // the keys it does not know and object spread keeps them, so parsing on the write path
  // is what would delete a newer client's fields (docs/features/record-migrations.md).
  #writable(
    kind: "overview" | "overviewState",
    id: string,
    raw: unknown,
    migrations: readonly RecordMigration[],
  ): Record<string, unknown> {
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

  async #write(storeName: string, record: object): Promise<void> {
    const store = this.#db.transaction(storeName, "readwrite").objectStore(storeName);
    await promisifyRequest(store.put(record));
  }
}

const withStateDefaults = (raw: unknown): Record<string, unknown> => ({
  ...DEFAULT_OVERVIEW_STATE,
  ...(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}),
});

function quarantined<T>(
  raws: unknown[],
  kind: UnreadableRecordKind,
  keyPath: string,
  read: (raw: unknown) => StoredRecordRead<T>,
): UnreadableRecord[] {
  return raws.flatMap((raw) => {
    const result = read(raw);
    return result.status === "unreadable"
      ? [unreadableRecord(kind, storedRecordId(raw, keyPath), result, raw)]
      : [];
  });
}
