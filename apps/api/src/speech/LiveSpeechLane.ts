import { randomUUID } from "node:crypto";
import { narrationLanguage, type NarrationVoice } from "@overview/domain";
import type { Narration, Narrator, SpeechHost } from "../audio/Narrator.js";
import { FLY_MACHINE, MachineTime, MODAL_CONTAINER } from "./MachineTime.js";

export interface LiveSpeechPlay {
  voice: NarrationVoice;
  renderVersion: number;
  chunks: readonly (readonly string[])[];
  signal: AbortSignal;
  onChunk: (index: number, narration: Narration | null) => Promise<void>;
}

export type HostSeconds = Record<SpeechHost, number>;

export interface LiveSpeechOutcome {
  machineSeconds: HostSeconds;
  fellBack: boolean;
  modalGpu: string | null;
  cold: boolean;
  spoken: number;
  skipped: number;
  dropped: number;
  queueWaitSeconds: number;
}

export interface LiveSpeechWarmUp {
  machineSeconds: number;
  warmed: boolean;
  host: SpeechHost | null;
}

export interface LiveSpeechLaneOptions {
  narrator: Narrator;
  slots: number;
  clock: () => Date;
}

interface Waiting {
  play: LiveSpeechPlay;
  next: number;
  turn: number;
  outcome: LiveSpeechOutcome;
  queuedAt: Date;
  firstClaimedAt: Date | null;
  finish: (outcome: LiveSpeechOutcome) => void;
}

// In memory, beside the render queue, never retried: docs/features/chat-read-aloud.md, "The live lane".
export class LiveSpeechLane {
  #options: LiveSpeechLaneOptions;
  #waiting: Waiting[] = [];
  #busy = 0;
  #turns = 0;
  #times: Record<SpeechHost, MachineTime> = { fly: new MachineTime(FLY_MACHINE), modal: new MachineTime(MODAL_CONTAINER) };

  constructor(options: LiveSpeechLaneOptions) {
    this.#options = options;
  }

  play(play: LiveSpeechPlay): Promise<LiveSpeechOutcome> {
    return new Promise((finish) => {
      this.#waiting.push({
        play,
        next: 0,
        turn: 0,
        outcome: {
          machineSeconds: { fly: 0, modal: 0 },
          fellBack: false,
          modalGpu: null,
          cold: false,
          spoken: 0,
          skipped: 0,
          dropped: 0,
          queueWaitSeconds: 0,
        },
        queuedAt: this.#options.clock(),
        firstClaimedAt: null,
        finish,
      });
      play.signal.addEventListener("abort", () => this.#pump(), { once: true });
      this.#pump();
    });
  }

  async warm(): Promise<LiveSpeechWarmUp> {
    const { narrator, slots, clock } = this.#options;
    const now = clock();
    if (this.#busy >= slots || this.#times.fly.isWarm(now) || this.#times.modal.isWarm(now)) {
      return { machineSeconds: 0, warmed: false, host: null };
    }
    this.#busy += 1;
    const startedAt = clock();
    try {
      const host = await narrator.warm(randomUUID());
      const time = this.#times[host];
      const loadedBy = new Date(Math.max(clock().getTime(), startedAt.getTime() + time.warmLoadSeconds * 1000));
      return { machineSeconds: time.charge(startedAt, loadedBy).seconds, warmed: true, host };
    } finally {
      this.#busy -= 1;
      this.#pump();
    }
  }

  #pump(): void {
    this.#dropStopped();
    while (this.#busy < this.#options.slots) {
      const waiting = this.#nextTurn();
      if (waiting === undefined) {
        return;
      }
      this.#busy += 1;
      void this.#speak(waiting).finally(() => {
        this.#busy -= 1;
        this.#pump();
      });
    }
  }

  #dropStopped(): void {
    for (const waiting of this.#waiting.filter(({ play, turn }) => play.signal.aborted && turn >= 0)) {
      this.#settle(waiting, waiting.play.chunks.length - waiting.next);
    }
  }

  #settle(waiting: Waiting, dropped: number): void {
    this.#waiting = this.#waiting.filter((other) => other !== waiting);
    waiting.outcome.dropped += dropped;
    waiting.outcome.queueWaitSeconds =
      waiting.firstClaimedAt === null ? 0 : (waiting.firstClaimedAt.getTime() - waiting.queuedAt.getTime()) / 1000;
    waiting.finish(waiting.outcome);
  }

  #nextTurn(): Waiting | undefined {
    const ready = this.#waiting.filter((waiting) => waiting.next < waiting.play.chunks.length && waiting.turn >= 0);
    const firstOfAPlay = ready.find((waiting) => waiting.next === 0);
    if (firstOfAPlay !== undefined) {
      return firstOfAPlay;
    }
    return ready.reduce<Waiting | undefined>(
      (oldest, waiting) => (oldest === undefined || waiting.turn < oldest.turn ? waiting : oldest),
      undefined,
    );
  }

  async #speak(waiting: Waiting): Promise<void> {
    const { narrator, clock } = this.#options;
    const index = waiting.next;
    waiting.next += 1;
    this.#turns += 1;
    waiting.turn = -1;
    const startedAt = clock();
    waiting.firstClaimedAt ??= startedAt;
    const { play } = waiting;
    const narration = await narrator
      .narrate(
        { lines: [...play.chunks[index]!], voice: play.voice, language: narrationLanguage(play.voice), renderVersion: play.renderVersion },
        randomUUID(),
        async () => {},
      )
      .catch(() => null);
    if (narration !== null) {
      const charge = this.#times[narration.host].charge(startedAt, clock());
      waiting.outcome.machineSeconds[narration.host] += charge.seconds;
      waiting.outcome.cold ||= index === 0 && charge.cold;
      waiting.outcome.fellBack ||= narration.fellBack;
      if (narration.host === "modal" && narration.gpu !== null) {
        waiting.outcome.modalGpu = narration.gpu;
      }
    }
    if (narration === null) {
      waiting.outcome.skipped += 1;
    } else {
      waiting.outcome.spoken += 1;
    }
    if (!play.signal.aborted) {
      await play.onChunk(index, narration).catch(() => {});
    }
    waiting.turn = this.#turns;
    if (waiting.next >= play.chunks.length || play.signal.aborted) {
      this.#settle(waiting, play.chunks.length - waiting.next);
    }
  }
}
