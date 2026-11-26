// Events pushed as they happen, read once in order as NDJSON lines.
export class NdjsonChannel<T> {
  #queued: T[] = [];
  #closed = false;
  #wake: (() => void) | null = null;

  push(event: T): void {
    this.#queued.push(event);
    this.#wake?.();
  }

  close(): void {
    this.#closed = true;
    this.#wake?.();
  }

  async *lines(): AsyncGenerator<string> {
    while (true) {
      const event = this.#queued.shift();
      if (event !== undefined) {
        yield `${JSON.stringify(event)}\n`;
        continue;
      }
      if (this.#closed) {
        return;
      }
      await new Promise<void>((resolve) => (this.#wake = resolve));
      this.#wake = null;
    }
  }
}
