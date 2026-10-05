import type { CaptureQueueStore, PlaylistId, QueuedCapture, VideoId } from "@overview/domain";

export class InMemoryCaptureQueueStore implements CaptureQueueStore {
  #queue = new Map<string, QueuedCapture>();

  async listQueue() {
    return [...this.#queue.values()].sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
  }

  async enqueue(captures: QueuedCapture[]) {
    for (const capture of captures) {
      if (!this.#queue.has(capture.videoId)) this.#queue.set(capture.videoId, capture);
    }
  }

  async saveQueued(capture: QueuedCapture) {
    this.#queue.set(capture.videoId, capture);
  }

  async removeQueued(videoId: VideoId) {
    this.#queue.delete(videoId);
  }

  async removeWaiting(fromPlaylist?: PlaylistId) {
    for (const [videoId, capture] of this.#queue) {
      if (capture.status === "waiting" && (fromPlaylist === undefined || capture.fromPlaylist.id === fromPlaylist)) {
        this.#queue.delete(videoId);
      }
    }
  }
}
