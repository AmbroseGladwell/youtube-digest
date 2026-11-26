export const IDLE_EXIT_SECONDS = 15;
export const MACHINE_START_SECONDS = 2;
export const MODEL_LOAD_SECONDS = 5;

export interface MachineCharge {
  seconds: number;
  cold: boolean;
}

// What one call adds to the live machine's billed time: docs/features/chat-read-aloud.md, "What a play costs".
export class MachineTime {
  #runsUntil = 0;

  charge(startedAt: Date, endedAt: Date): MachineCharge {
    const start = startedAt.getTime() / 1000;
    const end = endedAt.getTime() / 1000;
    const cold = start >= this.#runsUntil;
    const from = cold ? start - MACHINE_START_SECONDS : this.#runsUntil;
    const until = Math.max(this.#runsUntil, end + IDLE_EXIT_SECONDS);
    const seconds = Math.max(0, until - from);
    this.#runsUntil = until;
    return { seconds, cold };
  }

  isWarm(at: Date): boolean {
    return at.getTime() / 1000 < this.#runsUntil;
  }
}
