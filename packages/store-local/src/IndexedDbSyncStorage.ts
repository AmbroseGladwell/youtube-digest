import {
  CURRENT_SCHEMA_VERSIONS,
  DEFAULT_OVERVIEW_STATE,
  DEFAULT_SETTINGS,
  FOLLOWED_PLAYLIST_MIGRATIONS,
  OVERVIEW_MIGRATIONS,
  OVERVIEW_STATE_MIGRATIONS,
  SETTINGS_MIGRATIONS,
  QueuedCapture,
  StoredTranscript,
  SYNCED_RECORD_KINDS,
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
  CAPTURE_QUEUE_STORE,
  FOLLOWED_PLAYLISTS_STORE,
  OUTBOX_STORE,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  PLAYLIST_CHECKS_STORE,
  SETTINGS_KEY,
  SETTINGS_STORE,
  SYNC_CURSOR_KEY,
  SYNC_CURSOR_KINDS_KEY,
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
  followedPlaylist: FOLLOWED_PLAYLISTS_STORE,
};

const KEY_PATHS: Record<SyncedRecordKind, string | null> = {
  overview: "id",
  overviewState: "overviewId",
  topic: "id",
  settings: null,
  followedPlaylist: "id",
};

const MIGRATIONS: Record<SyncedRecordKind, readonly RecordMigration[]> = {
  overview: OVERVIEW_MIGRATIONS,
  overviewState: OVERVIEW_STATE_MIGRATIONS,
  topic: TOPIC_MIGRATIONS,
  settings: SETTINGS_MIGRATIONS,
  followedPlaylist: FOLLOWED_PLAYLIST_MIGRATIONS,
};

// What every library that pulled before the cursor's kinds were kept was pulled with.
const KINDS_BEFORE_THEY_WERE_KEPT: readonly string[] = ["overview", "overviewState", "topic", "settings"];

const BOOKKEEPING_STORES = [OUTBOX_STORE, SYNC_REVISIONS_STORE, SYNC_META_STORE];
const EVERY_STORE = [...Object.values(RECORD_STORES), ...BOOKKEEPING_STORES];
// What a followed playlist left on this device, which goes when another device unfollows it.
const FOLLOWING_STORES = [PLAYLIST_CHECKS_STORE, CAPTURE_QUEUE_STORE];
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
      for (const write of await this.#transcriptWrites(transaction)) outbox.add({ ...write, stuck: null });
      meta.put(true, SYNC_TRANSCRIPTS_ENROLLED_KEY);
    }
    await promisifyTransaction(transaction);
  }

  // Only the transcripts behind a note, and none already waiting to be sent: captions kept
  // because a video was open stay on this device (docs/features/transcript-storage.md).
  async #transcriptWrites(transaction: IDBTransaction): Promise<PendingWrite[]> {
    const [overviews, transcripts, pending] = await Promise.all([
      promisifyRequest<unknown[]>(transaction.objectStore(OVERVIEWS_STORE).getAll()),
      promisifyRequest<unknown[]>(transaction.objectStore(TRANSCRIPTS_STORE).getAll()),
      promisifyRequest<OutboxEntry[]>(transaction.objectStore(OUTBOX_STORE).getAll()),
    ]);
    const noteOn = new Map(overviews.flatMap(notedVideo));
    const queued = new Set(pending.filter((entry) => entry.kind === "transcript").map((entry) => entry.id));
    return transcripts.flatMap((raw) => {
      const transcript = readableTranscript(raw);
      const overviewId = transcript === null ? undefined : noteOn.get(transcript.videoId);
      if (transcript === null || overviewId === undefined || queued.has(transcript.videoId)) return [];
      return [transcriptWrite(transcript, overviewId)];
    });
  }

  async #libraryWrites(transaction: IDBTransaction): Promise<PendingWrite[]> {
    const overviews = promisifyRequest<unknown[]>(transaction.objectStore(OVERVIEWS_STORE).getAll());
    const states = promisifyRequest<unknown[]>(transaction.objectStore(OVERVIEW_STATES_STORE).getAll());
    const topics = promisifyRequest<unknown[]>(transaction.objectStore(TOPICS_STORE).getAll());
    const followed = promisifyRequest<unknown[]>(transaction.objectStore(FOLLOWED_PLAYLISTS_STORE).getAll());
    const settings = promisifyRequest<unknown>(transaction.objectStore(SETTINGS_STORE).get(SETTINGS_KEY));

    const now = this.#now();
    return [
      ...(await overviews).flatMap((raw) => wholeRecordWrite("overview", raw, "savedAt", now)),
      ...(await topics).flatMap((raw) => wholeRecordWrite("topic", raw, "createdAt", now)),
      ...(await followed).flatMap((raw) => wholeRecordWrite("followedPlaylist", raw, "followedAt", now)),
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
    const [cursor, kinds] = await Promise.all([
      promisifyRequest<unknown>(meta.get(SYNC_CURSOR_KEY)),
      promisifyRequest<unknown>(meta.get(SYNC_CURSOR_KINDS_KEY)),
    ]);
    const pulledWith = Array.isArray(kinds) ? kinds : KINDS_BEFORE_THEY_WERE_KEPT;
    const coversEveryKind = SYNCED_RECORD_KINDS.every((kind) => pulledWith.includes(kind));
    return typeof cursor === "number" && coversEveryKind ? cursor : 0;
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

  async transcriptToPush(videoId: string): Promise<StoredTranscript | null> {
    const transaction = this.#db.transaction([TRANSCRIPTS_STORE, OVERVIEWS_STORE], "readonly");
    const [raw, overviews] = await Promise.all([
      promisifyRequest<unknown>(transaction.objectStore(TRANSCRIPTS_STORE).get(videoId)),
      promisifyRequest<unknown[]>(transaction.objectStore(OVERVIEWS_STORE).getAll()),
    ]);
    if (raw === undefined || !overviews.flatMap(notedVideo).some(([noted]) => noted === videoId)) return null;
    return readableTranscript(raw);
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
    const transaction = this.#db.transaction([...EVERY_STORE, ...FOLLOWING_STORES], "readwrite");
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
        if (change.kind === "followedPlaylist") await forgetFollowing(transaction, change.id);
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
    transaction.objectStore(SYNC_META_STORE).put([...SYNCED_RECORD_KINDS], SYNC_CURSOR_KINDS_KEY);
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
  kind: "overview" | "topic" | "followedPlaylist",
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

// What this device had seen of a playlist, and what it still had waiting from it. A video
// that needs the reader's attention stays until they dismiss it (docs/features/playlists.md).
async function forgetFollowing(transaction: IDBTransaction, playlistId: string): Promise<void> {
  transaction.objectStore(PLAYLIST_CHECKS_STORE).delete(playlistId);
  const queue = transaction.objectStore(CAPTURE_QUEUE_STORE);
  for (const raw of await promisifyRequest<unknown[]>(queue.getAll())) {
    const parsed = QueuedCapture.safeParse(raw);
    if (parsed.success && parsed.data.status === "waiting" && parsed.data.fromPlaylist.id === playlistId) {
      queue.delete(parsed.data.videoId);
    }
  }
}

function readableTranscript(raw: unknown): StoredTranscript | null {
  const read = readStoredRecord(raw, StoredTranscript, []);
  return read.status === "read" ? read.record : null;
}

function notedVideo(raw: unknown): Array<[videoId: string, overviewId: string]> {
  const overview = readable("overview", raw);
  const video = overview?.video;
  return isObject(video) && typeof video.id === "string" && typeof overview?.id === "string"
    ? [[video.id, overview.id]]
    : [];
}

function transcriptWrite(transcript: StoredTranscript, overviewId: string): PendingWrite {
  return {
    kind: "transcript",
    id: transcript.videoId,
    updatedAt: transcript.fetchedAt,
    change: { op: "transcript", overviewId },
  };
}
