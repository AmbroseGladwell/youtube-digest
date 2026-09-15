import { z } from "zod";

/**
 * `none` is a real value here, distinct from the section being toggled
 * off — `Selling.type === "none"` means Selling ran and found nothing;
 * `Note.selling === null` means the toggle was off and it didn't run at
 * all. Engagement-bait (asking for likes/comments/gym recommendations) is
 * deliberately not a category: it's normal behaviour on nearly every
 * video, so flagging it would discriminate nothing, the same failure shape
 * as the old verdict scale's 77%-in-one-bucket problem. See
 * docs/note-generation-decisions.md, "Selling: one card label, richer data
 * underneath".
 */
export const SellingType = z.enum([
  "own_paid_product",
  "own_free_promotion",
  "sponsor_or_affiliate",
  "none",
]);
export type SellingType = z.infer<typeof SellingType>;

export const Selling = z.object({
  type: SellingType,
  /**
   * One structured sentence for the expanded note view. Deliberately not
   * shown on the card — the card carries exactly one consistent chip
   * (present when `type !== "none"`), never a per-category badge. The
   * richer breakdown by type lives here and in a library-level stats view,
   * where the cross-note pattern this section exists to surface actually
   * gets computed.
   */
  detail: z.string(),
  /**
   * Feeds Verdict's `dubious` conflict-of-interest check (the advice
   * conveniently requires something being sold). Never rendered as its own
   * card badge — Verdict's badge already covers it, and duplicating it
   * would be exactly the card clutter this design was trying to avoid.
   * Turning the Selling toggle off also turns this check off; it never
   * runs silently in the background once declined.
   */
  compromisesContent: z.boolean(),
});
export type Selling = z.infer<typeof Selling>;
