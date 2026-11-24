import {
  OverviewId,
  QueuedCapture,
  type Capture,
  type CaptureQueueStore,
  type KeptCapture,
  type PlaylistId,
  type VideoId,
} from "@overview/domain";
import type { IndexedDbCaptureStore } from "./IndexedDbCaptureStore.js";
import { CAPTURE_QUEUE_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

const keptFor = (queued: QueuedCapture, id: OverviewId): KeptCapture => ({
  id,
  sourceKey: queued.videoId,
  url: queued.url,
  keptAt: queued.queuedAt,
  keptFrom: "playlist",
  captureReason: null,
  title: queued.title,
  thumbnailUrl: queued.thumbnailUrl,
  fromPlaylist: queued.fromPlaylist,
  addedAt: queued.addedAt,
  playlistIndex: queued.playlistIndex,
  chosenAt: queued.chosenAt,
  stage: "kept",
  source: null,
  waitingFor: "turn",
  resumesAt: null,
  queueStatus: queued.status,
  problem: queued.problem,
});

const queuedOf = (capture: Capture): QueuedCapture[] => {
  if (capture.stage !== "kept" || capture.fromPlaylist === null) {
    return [];
  }
  return [
    {
      videoId: capture.sourceKey,
      url: capture.url,
      title: capture.title ?? "",
      thumbnailUrl: capture.thumbnailUrl,
      fromPlaylist: capture.fromPlaylist,
      queuedAt: capture.keptAt,
      status: capture.queueStatus,
      problem: capture.problem,
      chosenAt: capture.chosenAt,
      addedAt: capture.addedAt,
      playlistIndex: capture.playlistIndex,
    },
  ];
};

const firstOfEachVideo = (queue: QueuedCapture[]): QueuedCapture[] => {
  const seen = new Set<string>();
  return queue.filter((queued) => !seen.has(queued.videoId) && seen.add(queued.videoId));
};

const newCaptureId = (): OverviewId => OverviewId.parse(globalThis.crypto.randomUUID());

// Playlist videos as synced captures: docs/features/capture-queue.md, "One queue on every device".
export class IndexedDbCaptureQueueStore implements CaptureQueueStore {
  #db: IDBDatabase;
  #captures: IndexedDbCaptureStore;
  #movedFromDevice: Promise<void> | null = null;

  constructor(db: IDBDatabase, captures: IndexedDbCaptureStore) {
    this.#db = db;
    this.#captures = captures;
  }

  async listQueue(): Promise<QueuedCapture[]> {
    await this.#moveDeviceQueue();
    return this.#listQueue();
  }

  async enqueue(captures: QueuedCapture[]): Promise<void> {
    await this.#moveDeviceQueue();
    await this.#enqueue(captures);
  }

  async saveQueued(queued: QueuedCapture): Promise<void> {
    await this.#moveDeviceQueue();
    const existing = await this.#captures.captureOfSource(queued.videoId);
    await this.#captures.saveCapture(
      existing === null ? keptFor(queued, newCaptureId()) : { ...existing, ...keptFor(queued, existing.id) },
    );
  }

  async removeQueued(videoId: VideoId): Promise<void> {
    await this.#moveDeviceQueue();
    const existing = await this.#captures.captureOfSource(videoId);
    if (existing !== null) {
      await this.#captures.removeCapture(existing.id);
    }
  }

  async removeWaiting(fromPlaylist?: PlaylistId): Promise<void> {
    await this.#moveDeviceQueue();
    for (const capture of await this.#captures.listCaptures()) {
      const waiting = capture.stage === "kept" && capture.fromPlaylist !== null && capture.queueStatus === "waiting";
      if (waiting && (fromPlaylist === undefined || capture.fromPlaylist!.id === fromPlaylist)) {
        await this.#captures.removeCapture(capture.id);
      }
    }
  }

  async #listQueue(): Promise<QueuedCapture[]> {
    const queue = (await this.#captures.listCaptures()).flatMap(queuedOf);
    return firstOfEachVideo(queue.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt)));
  }

  async #enqueue(captures: QueuedCapture[]): Promise<void> {
    for (const queued of captures) {
      if ((await this.#captures.captureOfSource(queued.videoId)) === null) {
        await this.#captures.saveCapture(keptFor(queued, newCaptureId()));
      }
    }
  }

  // Once per open: what this device queued before the queue synced joins it (OV-358).
  #moveDeviceQueue(): Promise<void> {
    this.#movedFromDevice ??= (async () => {
      const store = this.#db.transaction(CAPTURE_QUEUE_STORE, "readonly").objectStore(CAPTURE_QUEUE_STORE);
      const raws = await promisifyRequest<unknown[]>(store.getAll());
      if (raws.length === 0) {
        return;
      }
      const queued = raws.flatMap((raw) => {
        const parsed = QueuedCapture.safeParse(raw);
        return parsed.success ? [parsed.data] : [];
      });
      await this.#enqueue(queued);
      const clearing = this.#db.transaction(CAPTURE_QUEUE_STORE, "readwrite");
      clearing.objectStore(CAPTURE_QUEUE_STORE).clear();
      await promisifyTransaction(clearing);
    })();
    return this.#movedFromDevice;
  }
}
