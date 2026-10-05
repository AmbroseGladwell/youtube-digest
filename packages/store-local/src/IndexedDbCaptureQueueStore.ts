import {
  QueuedCapture,
  type CaptureQueueStore,
  type PlaylistId,
  type VideoId,
} from "@overview/domain";
import { CAPTURE_QUEUE_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

// Never journaled: the queue is this device's own until OV-11 syncs it
// (docs/features/capture-queue.md).
export class IndexedDbCaptureQueueStore implements CaptureQueueStore {
  #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
  }

  async listQueue(): Promise<QueuedCapture[]> {
    const store = this.#db.transaction(CAPTURE_QUEUE_STORE, "readonly").objectStore(CAPTURE_QUEUE_STORE);
    const raws = await promisifyRequest<unknown[]>(store.getAll());
    return raws
      .flatMap((raw) => {
        const parsed = QueuedCapture.safeParse(raw);
        return parsed.success ? [parsed.data] : [];
      })
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
  }

  async enqueue(captures: QueuedCapture[]): Promise<void> {
    const transaction = this.#db.transaction(CAPTURE_QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(CAPTURE_QUEUE_STORE);
    for (const capture of captures) {
      if ((await promisifyRequest(store.getKey(capture.videoId))) === undefined) store.put(capture);
    }
    await promisifyTransaction(transaction);
  }

  async saveQueued(capture: QueuedCapture): Promise<void> {
    const transaction = this.#db.transaction(CAPTURE_QUEUE_STORE, "readwrite");
    transaction.objectStore(CAPTURE_QUEUE_STORE).put(capture);
    await promisifyTransaction(transaction);
  }

  async removeQueued(videoId: VideoId): Promise<void> {
    const transaction = this.#db.transaction(CAPTURE_QUEUE_STORE, "readwrite");
    transaction.objectStore(CAPTURE_QUEUE_STORE).delete(videoId);
    await promisifyTransaction(transaction);
  }

  async removeWaiting(fromPlaylist?: PlaylistId): Promise<void> {
    const transaction = this.#db.transaction(CAPTURE_QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(CAPTURE_QUEUE_STORE);
    for (const raw of await promisifyRequest<unknown[]>(store.getAll())) {
      const parsed = QueuedCapture.safeParse(raw);
      if (!parsed.success) continue;
      const capture = parsed.data;
      if (capture.status === "waiting" && (fromPlaylist === undefined || capture.fromPlaylist.id === fromPlaylist)) {
        store.delete(capture.videoId);
      }
    }
    await promisifyTransaction(transaction);
  }
}
