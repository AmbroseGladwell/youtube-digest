import type { StoredTranscript, TranscriptStore, VideoId } from "@overview/types";
import { TRANSCRIPTS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

export class IndexedDbTranscriptStore implements TranscriptStore {
  #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
  }

  async getTranscript(videoId: VideoId) {
    const store = this.#db.transaction(TRANSCRIPTS_STORE, "readonly").objectStore(TRANSCRIPTS_STORE);
    const transcript = await promisifyRequest<StoredTranscript | undefined>(store.get(videoId));
    return transcript ?? null;
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
