import type { Capture, CaptureStore, OverviewId, SourceKey } from "@overview/domain";

export class InMemoryCaptureStore implements CaptureStore {
  #captures = new Map<OverviewId, Capture>();

  async listCaptures() {
    return [...this.#captures.values()].sort((left, right) => left.keptAt.localeCompare(right.keptAt));
  }

  async getCapture(id: OverviewId) {
    return this.#captures.get(id) ?? null;
  }

  async captureOfSource(key: SourceKey) {
    return [...this.#captures.values()].find((capture) => capture.sourceKey === key) ?? null;
  }

  async saveCapture(capture: Capture) {
    this.#captures.set(capture.id, capture);
  }

  async removeCapture(id: OverviewId) {
    this.#captures.delete(id);
  }

  seedCapture(capture: Capture) {
    this.#captures.set(capture.id, capture);
  }
}
