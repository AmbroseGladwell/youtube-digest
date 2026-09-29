import {
  StoredTranscript,
  readStoredRecord,
  type TranscriptStore,
  type VideoId,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { TRANSCRIPTS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

// The one store that discards rather than quarantines: a transcript that cannot be read
// is a cache miss costing one call to fill, not a note that took 30,000 tokens to write
// (docs/features/record-migrations.md). The row is left where it is rather than deleted,
// because a read that writes is not a read.
export class IndexedDbTranscriptStore implements TranscriptStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  async getTranscript(videoId: VideoId) {
    const store = this.#db.transaction(TRANSCRIPTS_STORE, "readonly").objectStore(TRANSCRIPTS_STORE);
    const raw = await promisifyRequest<unknown>(store.get(videoId));
    if (raw === undefined) {
      return null;
    }
    const read = readStoredRecord(raw, StoredTranscript, []);
    return read.status === "read" ? read.record : null;
  }

  async saveTranscript(transcript: StoredTranscript) {
    const transaction = this.#db.transaction([TRANSCRIPTS_STORE, ...JOURNALLED_STORES], "readwrite");
    transaction.objectStore(TRANSCRIPTS_STORE).put(transcript);
    const journaled = await appendPendingWrite(transaction, {
      kind: "transcript",
      id: transcript.videoId,
      updatedAt: transcript.fetchedAt,
      change: { op: "transcript" },
    });
    await promisifyTransaction(transaction);
    if (journaled) this.#onJournaled?.();
  }

  async deleteTranscript(videoId: VideoId) {
    const store = this.#db.transaction(TRANSCRIPTS_STORE, "readwrite").objectStore(TRANSCRIPTS_STORE);
    await promisifyRequest(store.delete(videoId));
  }
}
