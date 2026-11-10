import type { NoteKind, Overview, Provider } from "@overview/domain";
import type { MeteredCall } from "@overview/generation";

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
  // Every call, the kind check's included; attempts holds only the note's answers.
  costDollars: number | null;
  attempts: unknown[];
  overview: Overview | null;
  // What the kind check answered and cost, apart from the note (OV-275). Absent on runs from
  // before it, and on articles, which have no check.
  kindCheck?: { noteKind: NoteKind | null; costDollars: number | null };
}
