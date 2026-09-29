import {
  CURRENT_SCHEMA_VERSIONS,
  DEFAULT_OVERVIEW_STATE,
  DEFAULT_SETTINGS,
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  SETTINGS_MIGRATIONS,
  StoredTranscript,
  TOPIC_MIGRATIONS,
  migrateStoredRecord,
  readStoredRecord,
  rebasePendingChanges,
  stampStoredRecord,
  storedUpdatedAt,
  type OutboxEntry,
  type OutboxFailure,
  type OutboxKind,
  type PendingWrite,
  type RecordChange,
  type RecordMigration,
  type SyncStorage,
  type SyncedRecordKind,
  type WriteAcknowledgement,
} from "@overview/domain";
import {
  OUTBOX_STORE,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  SETTINGS_KEY,
  SETTINGS_STORE,
  SYNC_CURSOR_KEY,
  SYNC_ENROLLED_KEY,
  SYNC_META_STORE,
  SYNC_REVISIONS_STORE,
  SYNC_TRANSCRIPTS_ENROLLED_KEY,
  TOPICS_STORE,
  TRANSCRIPTS_STORE,
} from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

const RECORD_STORES: Record<SyncedRecordKind, string> = {
  overview: OVERVIEWS_STORE,
  overviewState: OVERVIEW_STATES_STORE,
  topic: TOPICS_STORE,
  settings: SETTINGS_STORE,
};

const KEY_PATHS: Record<SyncedRecordKind, string | null> = {
  overview: "id",
  overviewState: "overviewId",
  topic: "id",
  settings: null,
};

const MIGRATIONS: Record<SyncedRecordKind, readonly RecordMigration[]> = {
  overview: OVERVIEW_MIGRATIONS,
  overviewState: OVERVIEW_STATE_MIGRATIONS,
  topic: TOPIC_MIGRATIONS,
  settings: SETTINGS_MIGRATIONS,
};

const BOOKKEEPING_STORES = [OUTBOX_STORE, SYNC_REVISIONS_STORE, SYNC_META_STORE];
const EVERY_STORE = [...Object.values(RECORD_STORES), ...BOOKKEEPING_STORES];
const ENROLMENT_STORES = [...EVERY_STORE, TRANSCRIPTS_STORE];

export interface IndexedDbSyncStorageOptions {
  now?: (() => Date) | undefined;
}

export class IndexedDbSyncStorage implements SyncStorage {
  #db: IDBDatabase;
  #now: () => Date;
  #listeners = new Set<() => void>();

  constructor(db: IDBDatabase, { now = () => new Date() }: IndexedDbSyncStorageOptions = {}) {
    this.#db = db;
    this.#now = now;
  }

  notifyJournaled = (): void => {
    for (const listener of this.#listeners) listener();
  };

  onJournaled(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async isEnrolled(): Promise<boolean> {
    const meta = this.#db.transaction(SYNC_META_STORE, "readonly").objectStore(SYNC_META_STORE);
    const [records, transcripts] = await Promise.all([
      promisifyRequest(meta.get(SYNC_ENROLLED_KEY)),
      promisifyRequest(meta.get(SYNC_TRANSCRIPTS_ENROLLED_KEY)),
    ]);
    return records === true && transcripts === true;
  }

  // Everything the library already holds becomes a pending write, at this client's own
  // version, because no client ever writes at any other. What this client cannot read it
  // cannot push either; that stays quarantined and counted where it is
  // (docs/features/sync-client.md).
  async enrol(): Promise<void> {
    const transaction = this.#db.transaction(ENROLMENT_STORES, "readwrite");
    const meta = transaction.objectStore(SYNC_META_STORE);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const [recordsEnrolled, transcriptsEnrolled] = await Promise.all([
      promisifyRequest(meta.get(SYNC_ENROLLED_KEY)),
      promisifyRequest(meta.get(SYNC_TRANSCRIPTS_ENROLLED_KEY)),
    ]);

    if (recordsEnrolled !== true) {
      for (const write of await this.#libraryWrites(transaction)) outbox.add({ ...write, stuck: null });
      meta.put(true, SYNC_ENROLLED_KEY);
    }
    if (transcriptsEnrolled !== true) {
      const transcripts = await promisifyRequest<unknown[]>(transaction.objectStore(TRANSCRIPTS_STORE).getAll());
      for (const write of transcripts.flatMap(transcriptWrite)) outbox.add({ ...write, stuck: null });
      meta.put(true, SYNC_TRANSCRIPTS_ENROLLED_KEY);
    }
    await promisifyTransaction(transaction);
  }

  async #libraryWrites(transaction: IDBTransaction): Promise<PendingWrite[]> {
    const overviews = promisifyRequest<unknown[]>(transaction.objectStore(OVERVIEWS_STORE).getAll());
    const states = promisifyRequest<unknown[]>(transaction.objectStore(OVERVIEW_STATES_STORE).getAll());
    const topics = promisifyRequest<unknown[]>(transaction.objectStore(TOPICS_STORE).getAll());
    const settings = promisifyRequest<unknown>(transaction.objectStore(SETTINGS_STORE).get(SETTINGS_KEY));

    const now = this.#now();
    return [
      ...(await overviews).flatMap((raw) => wholeRecordWrite("overview", raw, "savedAt", now)),
      ...(await topics).flatMap((raw) => wholeRecordWrite("topic", raw, "createdAt", now)),
      ...(await states).flatMap((raw) => stateWrite(raw, now)),
      ...settingsWrite(await settings, now),
    ];
  }

  async leave(): Promise<void> {
    const transaction = this.#db.transaction(BOOKKEEPING_STORES, "readwrite");
    for (const store of BOOKKEEPING_STORES) transaction.objectStore(store).clear();
    await promisifyTransaction(transaction);
  }

  async cursor(): Promise<number> {
    const meta = this.#db.transaction(SYNC_META_STORE, "readonly").objectStore(SYNC_META_STORE);
    const cursor = await promisifyRequest<unknown>(meta.get(SYNC_CURSOR_KEY));
    return typeof cursor === "number" ? cursor : 0;
  }

  async listPending(): Promise<OutboxEntry[]> {
    const outbox = this.#db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE);
    return promisifyRequest<OutboxEntry[]>(outbox.getAll());
  }

  async acknowledge(key: number, outcome: WriteAcknowledgement): Promise<void> {
    const transaction = this.#db.transaction([OUTBOX_STORE, SYNC_REVISIONS_STORE], "readwrite");
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const entry = await promisifyRequest<OutboxEntry | undefined>(outbox.get(key));
    if (entry !== undefined) {
      outbox.delete(key);
      const revisions = transaction.objectStore(SYNC_REVISIONS_STORE);
      if ("rev" in outcome) {
        revisions.put({ kind: entry.kind, id: entry.id, rev: outcome.rev });
      } else if ("tombstoned" in outcome) {
        revisions.delete([entry.kind, entry.id]);
      }
    }
    await promisifyTransaction(transaction);
  }

  async park(key: number, failure: OutboxFailure): Promise<void> {
    const transaction = this.#db.transaction(OUTBOX_STORE, "readwrite");
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const entry = await promisifyRequest<OutboxEntry | undefined>(outbox.get(key));
    if (entry !== undefined) {
      outbox.put({ ...entry, stuck: failure });
    }
    await promisifyTransaction(transaction);
  }

  async revisionOf(kind: OutboxKind, id: string): Promise<number | null> {
    const revisions = this.#db.transaction(SYNC_REVISIONS_STORE, "readonly").objectStore(SYNC_REVISIONS_STORE);
    const known = await promisifyRequest<{ rev: number } | undefined>(revisions.get([kind, id]));
    return known?.rev ?? null;
  }

  async readTranscript(videoId: string): Promise<StoredTranscript | null> {
    const store = this.#db.transaction(TRANSCRIPTS_STORE, "readonly").objectStore(TRANSCRIPTS_STORE);
    const raw = await promisifyRequest<unknown>(store.get(videoId));
    return raw === undefined ? null : readableTranscript(raw);
  }

  async keepTranscript(transcript: StoredTranscript): Promise<void> {
    const transaction = this.#db.transaction(TRANSCRIPTS_STORE, "readwrite");
    transaction.objectStore(TRANSCRIPTS_STORE).put(transcript);
    await promisifyTransaction(transaction);
  }

  // One transaction for the page and the cursor after it, so a crash between the two
  // cannot leave a record applied and then pulled again, or a cursor past a record that
  // never landed. Pending local writes go back on top of what was pulled
  // (docs/features/sync-client.md).
  async applyChanges(changes: RecordChange[], next: number): Promise<void> {
    const transaction = this.#db.transaction(EVERY_STORE, "readwrite");
    const pending = groupPending(
      await promisifyRequest<OutboxEntry[]>(transaction.objectStore(OUTBOX_STORE).getAll()),
    );
    const revisions = transaction.objectStore(SYNC_REVISIONS_STORE);

    for (const change of changes) {
      const store = transaction.objectStore(RECORD_STORES[change.kind]);
      const key = change.kind === "settings" ? SETTINGS_KEY : change.id;

      if (change.deleted || change.body === undefined) {
        store.delete(key);
        if (change.kind === "overview") transaction.objectStore(OVERVIEW_STATES_STORE).delete(change.id);
        revisions.delete([change.kind, change.id]);
        continue;
      }

      const pulled = withKey(
        { ...change.body, schemaVersion: change.schemaVersion, updatedAt: change.updatedAt },
        change.kind,
        change.id,
      );
      const rebased = rebasePendingChanges(pulled, pending.get(pendingKey(change.kind, change.id)) ?? []);
      if (rebased === null) {
        store.delete(key);
      } else if (change.kind === "settings") {
        store.put(rebased, SETTINGS_KEY);
      } else {
        store.put(rebased);
      }
      revisions.put({ kind: change.kind, id: change.id, rev: change.rev });
    }

    transaction.objectStore(SYNC_META_STORE).put(next, SYNC_CURSOR_KEY);
    await promisifyTransaction(transaction);
  }
}

const pendingKey = (kind: OutboxKind, id: string) => `${kind}/${id}`;

function groupPending(entries: OutboxEntry[]): Map<string, OutboxEntry[]> {
  const grouped = new Map<string, OutboxEntry[]>();
  for (const entry of entries) {
    if (entry.stuck !== null) continue;
    const key = pendingKey(entry.kind, entry.id);
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  return grouped;
}

function withKey(record: Record<string, unknown>, kind: SyncedRecordKind, id: string): Record<string, unknown> {
  const keyPath = KEY_PATHS[kind];
  return keyPath === null ? record : { ...record, [keyPath]: id };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readable = (kind: SyncedRecordKind, raw: unknown): Record<string, unknown> | null => {
  const migrated = migrateStoredRecord(raw, MIGRATIONS[kind]);
  return migrated.status === "migrated" ? migrated.record : null;
};

// An undated record predates the stamp. The server needs a date on every write, so the
// record's own creation date stands in, and the moment of enrolment where there is none
// (docs/features/sync-metadata.md, "Absent means older than everything").
function writtenAt(raw: Record<string, unknown>, creationKey: string | null, now: Date): Date {
  const stamped = storedUpdatedAt(raw);
  if (stamped !== null) return new Date(stamped);
  const created = creationKey === null ? undefined : raw[creationKey];
  const parsed = typeof created === "string" ? new Date(created) : new Date(Number.NaN);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

function wholeRecordWrite(
  kind: "overview" | "topic",
  raw: unknown,
  creationKey: string,
  now: Date,
): PendingWrite[] {
  const migrated = readable(kind, raw);
  if (migrated === null || typeof migrated.id !== "string") return [];
  const at = writtenAt(migrated, creationKey, now);
  return [
    {
      kind,
      id: migrated.id,
      updatedAt: at.toISOString(),
      change: { op: "replace", record: stampStoredRecord(migrated, CURRENT_SCHEMA_VERSIONS[kind], at) },
    },
  ];
}

function stateWrite(raw: unknown, now: Date): PendingWrite[] {
  const migrated = readable("overviewState", { ...DEFAULT_OVERVIEW_STATE, ...(isObject(raw) ? raw : {}) });
  if (migrated === null || typeof migrated.overviewId !== "string") return [];
  const { read, favourite, userTags } = migrated;
  return [
    {
      kind: "overviewState",
      id: migrated.overviewId,
      updatedAt: writtenAt(migrated, null, now).toISOString(),
      change: { op: "state", patch: { read, favourite, userTags } },
    },
  ];
}

function settingsWrite(raw: unknown, now: Date): PendingWrite[] {
  if (raw === undefined) return [];
  const migrated = readable("settings", { ...DEFAULT_SETTINGS, ...(isObject(raw) ? raw : {}) });
  if (migrated === null) return [];
  const patch = Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS)
      .filter((key) => key in migrated)
      .map((key) => [key, migrated[key]]),
  );
  return [
    {
      kind: "settings",
      id: SETTINGS_KEY,
      updatedAt: writtenAt(migrated, null, now).toISOString(),
      change: { op: "settings", patch },
    },
  ];
}

function readableTranscript(raw: unknown): StoredTranscript | null {
  const read = readStoredRecord(raw, StoredTranscript, []);
  return read.status === "read" ? read.record : null;
}

function transcriptWrite(raw: unknown): PendingWrite[] {
  const transcript = readableTranscript(raw);
  if (transcript === null) return [];
  return [
    {
      kind: "transcript",
      id: transcript.videoId,
      updatedAt: transcript.fetchedAt,
      change: { op: "transcript" },
    },
  ];
}
