// At most `size` holders at once; the rest wait their turn, first come first served.
export class Slots {
  #free: number;
  #waiting: Array<() => void> = [];

  constructor(size: number) {
    this.#free = Math.max(1, size);
  }

  async take(): Promise<() => void> {
    if (this.#free > 0) {
      this.#free -= 1;
    } else {
      await new Promise<void>((resolve) => this.#waiting.push(resolve));
    }
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const next = this.#waiting.shift();
      if (next === undefined) {
        this.#free += 1;
      } else {
        next();
      }
    };
  }
}
