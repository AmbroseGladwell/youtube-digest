import { z } from "zod";

/**
 * Renamed from the prototype's "Try this" — see
 * docs/note-generation-decisions.md, "'Try this' renamed to 'How to
 * apply'". Only the header changed: the instruction underneath (1 to 3
 * concrete items, an honest empty case, never an invented action) is
 * untouched.
 *
 * Always generated when this section is requested, even when
 * `Verdict.soundnessFlag === "dubious"` — the schema never conditionally
 * drops this field based on a value computed in the same call. The UI
 * hides it behind a reveal in that case instead, so a note never silently
 * contradicts itself by suggesting actions right next to a claim it just
 * flagged as dubious, without costing a second generation round-trip for
 * the (likely common) case where the reader wants to see it anyway.
 */
export const HowToApply = z.object({
  /**
   * 1 to 3 concrete items — a specific thing, not a principle. Empty array
   * is the honest "nothing to apply" case, the same shape the prototype
   * already uses rather than inventing something to fill the space.
   */
  items: z.array(z.string()).max(3),
});
export type HowToApply = z.infer<typeof HowToApply>;
