import { z } from "zod";

/**
 * The primary, always-shown label. Replaces the prototype's single 5-value
 * scale (NOVEL / SOLID BUT FAMILIAR / RECYCLED / THIN / DUBIOUS), which
 * conflated "did I already know this" with "is this claim sound" — see
 * docs/note-generation-decisions.md, "The verdict scale: two axes, one
 * blunt label". THIN isn't a value here; it's `CoreFields.thin`, a gate
 * that skips Verdict entirely rather than a label Verdict produces.
 */
export const Novelty = z.enum(["novel", "competent_not_new", "recycled"]);
export type Novelty = z.infer<typeof Novelty>;

/**
 * The secondary signal — shown only when it fires, attached to any
 * novelty label rather than competing with it for the same slot.
 *
 * `overreaching` and `unverified` are both independent of `dubious`, and of
 * each other: `overreaching` is about argument quality (weak reasoning,
 * anecdote-as-evidence), `unverified` is about corroboration status (new or
 * niche enough that there's nothing to check it against either way — this
 * correlates with `novelty: "novel"` and must never suppress How-to-apply).
 * `dubious` is the narrow, rare, active-conflict case (contradicts settled
 * consensus, or the advice conveniently requires something being sold) and
 * is the only value of the three that changes How-to-apply's default
 * visibility. See docs/note-generation-decisions.md, "`dubious` split from
 * `unverified`".
 */
export const SoundnessFlag = z.enum(["overreaching", "unverified", "dubious"]);
export type SoundnessFlag = z.infer<typeof SoundnessFlag>;

export const SimilarNote = z.object({
  noteId: z.string(),
  title: z.string(),
});
export type SimilarNote = z.infer<typeof SimilarNote>;

/**
 * One of the four optional sections. `null` on `Note.verdict` means either
 * the toggle was off for this generation call, or `CoreFields.thin` was
 * true — the two are indistinguishable from `verdict` alone, which is why
 * `thin` lives on the note itself rather than being inferred from Verdict's
 * absence.
 */
export const Verdict = z.object({
  novelty: Novelty,
  /** `null`, not a "sound" enum value, when nothing fired. Most notes have
   * no soundness complaint at all. */
  soundnessFlag: SoundnessFlag.nullable(),
  reasoning: z.string(),
  /**
   * Populated by comparing this note's claim against the user's own past
   * claims, not the model's general sense of the genre — world knowledge
   * alone can only tell you "this is common," never "you already saved
   * this." Empty, not omitted, when nothing matches. See
   * docs/note-generation-decisions.md, "Personal-library novelty, not just
   * world knowledge".
   */
  similarTo: z.array(SimilarNote),
});
export type Verdict = z.infer<typeof Verdict>;
