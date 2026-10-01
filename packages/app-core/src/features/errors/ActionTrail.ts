import { MAX_ERROR_TRAIL, type AnalyticsEventName, type ClientErrorTrailEntry } from "@overview/domain";

// The last few things the reader did, by name, held in memory only and kept whether or not
// they are signed in: it leaves the device only attached to an error
// (docs/architecture/errors-and-logs.md, "The client").
export class ActionTrail {
  readonly #now: () => Date;
  #entries: ClientErrorTrailEntry[] = [];

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  record(name: AnalyticsEventName): void {
    this.#entries = [...this.#entries, { name, at: this.#now().toISOString() }].slice(-MAX_ERROR_TRAIL);
  }

  entries(): ClientErrorTrailEntry[] {
    return [...this.#entries];
  }
}
