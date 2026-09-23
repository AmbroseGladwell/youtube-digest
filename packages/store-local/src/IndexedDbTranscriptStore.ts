import {
  StoredTranscript,
  readStoredRecord,
  type TranscriptStore,
  type VideoId,
} from "@overview/domain";
import { TRANSCRIPTS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

// The one store that discards rather than quarantines: a transcript that cannot be read
// is a cache miss costing one call to fill, not a note that took 30,000 tokens to write
// (docs/features/record-migrations.md). The row is left where it is rather than deleted,
// because a read that writes is not a read.
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
