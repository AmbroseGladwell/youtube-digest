import {
  CAPTURE_MIGRATIONS,
  CURRENT_CAPTURE_SCHEMA_VERSION,
  Capture,
  readStoredRecord,
  stampStoredRecord,
  type CaptureStore,
  type OverviewId,
  type SourceKey,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { CAPTURES_BY_SOURCE_INDEX, CAPTURES_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

const readable = (raw: unknown): Capture[] => {
  const read = readStoredRecord(raw, Capture, CAPTURE_MIGRATIONS);
  return read.status === "read" ? [read.record] : [];
};

const hasTranscript = (capture: Capture): boolean => capture.stage === "saved" && capture.source.kind !== "web";

// docs/features/kept-links.md, "The record".
export class IndexedDbCaptureStore implements CaptureStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  async listCaptures(): Promise<Capture[]> {
    const store = this.#db.transaction(CAPTURES_STORE, "readonly").objectStore(CAPTURES_STORE);
    const captures = (await promisifyRequest<unknown[]>(store.getAll())).flatMap(readable);
    return captures.sort((left, right) => left.keptAt.localeCompare(right.keptAt));
  }

  async getCapture(id: OverviewId): Promise<Capture | null> {
    const store = this.#db.transaction(CAPTURES_STORE, "readonly").objectStore(CAPTURES_STORE);
    const raw = await promisifyRequest<unknown>(store.get(id));
    return raw === undefined ? null : (readable(raw)[0] ?? null);
  }

  async captureOfSource(key: SourceKey): Promise<Capture | null> {
    const store = this.#db.transaction(CAPTURES_STORE, "readonly").objectStore(CAPTURES_STORE);
    const raws = await promisifyRequest<unknown[]>(store.index(CAPTURES_BY_SOURCE_INDEX).getAll(key));
    return raws.flatMap(readable)[0] ?? null;
  }

  async saveCapture(capture: Capture): Promise<void> {
    const now = new Date();
    const updatedAt = now.toISOString();
    const record = stampStoredRecord(capture, CURRENT_CAPTURE_SCHEMA_VERSION, now);
    const transaction = this.#db.transaction([CAPTURES_STORE, ...JOURNALLED_STORES], "readwrite");
    transaction.objectStore(CAPTURES_STORE).put(record);
    const journaled = await appendPendingWrite(transaction, {
      kind: "capture",
      id: capture.id,
      updatedAt,
      change: { op: "replace", record },
    });
    if (journaled && hasTranscript(capture)) {
      await appendPendingWrite(transaction, {
        kind: "transcript",
        id: capture.sourceKey,
        updatedAt,
        change: { op: "transcript", overviewId: capture.id },
      });
    }
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }

  async removeCapture(id: OverviewId): Promise<void> {
    const transaction = this.#db.transaction([CAPTURES_STORE, ...JOURNALLED_STORES], "readwrite");
    const captures = transaction.objectStore(CAPTURES_STORE);
    const existing = await promisifyRequest<unknown>(captures.get(id));
    captures.delete(id);
    const journaled =
      existing !== undefined &&
      (await appendPendingWrite(transaction, { kind: "capture", id, updatedAt: new Date().toISOString(), change: { op: "delete" } }));
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }
}
