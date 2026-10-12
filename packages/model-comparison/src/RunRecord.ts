import type { Overview, Provider } from "@overview/domain";
import type { MeteredCall } from "./meteredFetch.js";

// "failed" is the model's doing and is part of the result; "errored" is the provider or
// the network, and a later run tries it again.
export type RunOutcome = "passed-first" | "passed-after-retry" | "failed" | "errored";

export interface RunRecord {
  videoId: string;
  provider: Provider;
  model: string;
  startedAt: string;
  outcome: RunOutcome;
  error: string | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
  attempts: unknown[];
  overview: Overview | null;
}
