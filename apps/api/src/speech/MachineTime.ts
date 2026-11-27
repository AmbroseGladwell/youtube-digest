export const IDLE_EXIT_SECONDS = 15;
export const MACHINE_START_SECONDS = 2;
export const MODEL_LOAD_SECONDS = 5;

export interface MachineModel {
  startSeconds: number;
  idleSeconds: number;
  warmLoadSeconds: number;
}

// Why the two differ: docs/features/chat-read-aloud.md, "What a play costs".
export const FLY_MACHINE: MachineModel = {
  startSeconds: MACHINE_START_SECONDS,
  idleSeconds: IDLE_EXIT_SECONDS,
  warmLoadSeconds: MODEL_LOAD_SECONDS,
};
export const MODAL_CONTAINER: MachineModel = { startSeconds: 0, idleSeconds: 20, warmLoadSeconds: 0 };

export interface MachineCharge {
  seconds: number;
  cold: boolean;
}

// What one call adds to the live machine's billed time: docs/features/chat-read-aloud.md, "What a play costs".
export class MachineTime {
  #runsUntil = 0;
  #model: MachineModel;

  constructor(model: MachineModel = FLY_MACHINE) {
    this.#model = model;
  }

  get warmLoadSeconds(): number {
    return this.#model.warmLoadSeconds;
  }

  charge(startedAt: Date, endedAt: Date): MachineCharge {
    const start = startedAt.getTime() / 1000;
    const end = endedAt.getTime() / 1000;
    const cold = start >= this.#runsUntil;
    const from = cold ? start - this.#model.startSeconds : this.#runsUntil;
    const until = Math.max(this.#runsUntil, end + this.#model.idleSeconds);
    const seconds = Math.max(0, until - from);
    this.#runsUntil = until;
    return { seconds, cold };
  }

  isWarm(at: Date): boolean {
    return at.getTime() / 1000 < this.#runsUntil;
  }
}
