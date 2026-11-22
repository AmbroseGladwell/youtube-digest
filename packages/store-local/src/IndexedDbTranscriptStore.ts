import { StoredTranscript, readStoredRecord, type TranscriptStore, type VideoId } from "@overview/domain";
import { TRANSCRIPTS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

// Discards, never quarantines: docs/features/record-migrations.md, "Not every store deserves the same treatment".
export class IndexedDbTranscriptStore implements TranscriptStore {
  #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
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
    const store = this.#db.transaction(TRANSCRIPTS_STORE, "readwrite").objectStore(TRANSCRIPTS_STORE);
    await promisifyRequest(store.put(transcript));
  }

  async deleteTranscript(videoId: VideoId) {
    const store = this.#db.transaction(TRANSCRIPTS_STORE, "readwrite").objectStore(TRANSCRIPTS_STORE);
    await promisifyRequest(store.delete(videoId));
  }
}
