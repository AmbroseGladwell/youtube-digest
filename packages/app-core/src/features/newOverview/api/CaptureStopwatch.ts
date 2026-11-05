import type { CaptureOutcome, CaptureStep, CaptureStepOutcome, CaptureTimedStep, ClientTimingReport } from "@overview/domain";

// Every number here is a delta of one real clock on the device, taken around the step as
// it ran: nothing is estimated, and a step never begun has no entry
// (docs/architecture/errors-and-logs.md, "Client timings").
export class CaptureStopwatch {
  readonly #now: () => number;
  readonly #startedAt: number;
  readonly #steps: CaptureTimedStep[] = [];

  constructor(now: () => number = () => performance.now()) {
    this.#now = now;
    this.#startedAt = now();
  }

  begin(step: CaptureStep): (outcome: CaptureStepOutcome) => void {
    const from = this.#now();
    return (outcome) => {
      this.#steps.push({ step, outcome, ms: Math.round(this.#now() - from) });
    };
  }

  async time<T>(step: CaptureStep, run: () => Promise<T>, outcomeOf: (result: T) => CaptureStepOutcome = () => "answered"): Promise<T> {
    const end = this.begin(step);
    try {
      const result = await run();
      end(outcomeOf(result));
      return result;
    } catch (error) {
      end("failed");
      throw error;
    }
  }

  report(outcome: CaptureOutcome, transcriptCharacters: number): ClientTimingReport {
    return {
      name: "captureTimed",
      outcome,
      steps: [...this.#steps],
      totalMs: Math.round(this.#now() - this.#startedAt),
      transcriptCharacters,
    };
  }
}
