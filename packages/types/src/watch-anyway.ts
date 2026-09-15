import { z } from "zod";

export const WatchAnswer = z.enum(["yes", "no", "partial"]);
export type WatchAnswer = z.infer<typeof WatchAnswer>;

/**
 * A real seek range, not a description of one. Only meaningful because
 * transcript source is pinned to Supadata (docs/v1-architecture-decisions.md),
 * whose native mode carries YouTube's own per-segment start/duration timing.
 * The generation step reads an offset already present in its own input —
 * it never measures or estimates one, which is exactly the operation
 * docs/constraints.md's rule against a model timing something itself would
 * otherwise forbid.
 */
export const TimeRange = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});
export type TimeRange = z.infer<typeof TimeRange>;

/**
 * One of the four optional sections. Defaults to "no" — see
 * prototype/summary-prompt.md and docs/decisions.md: a soft "yes" costs the
 * reader ten minutes they won't get back, so the bar for "yes" or "partial"
 * is deliberately high.
 *
 * `partial` exists because a real sample's only genuine "yes" was actually
 * "yes, for one section" — forcing that into strict yes/no would have told
 * the reader to watch a whole video only a fraction of which mattered. See
 * docs/note-generation-decisions.md, "Watch it anyway: a real gap the
 * samples expose".
 */
export const WatchAnyway = z.object({
  answer: WatchAnswer,
  reason: z.string(),
  /** Populated only when `answer === "partial"`. */
  range: TimeRange.nullable(),
});
export type WatchAnyway = z.infer<typeof WatchAnyway>;
