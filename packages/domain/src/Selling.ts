import { z } from "zod";

export const SellingType = z.enum([
  "own_paid_product",
  "own_free_promotion",
  "sponsor_or_affiliate",
  "none",
]);
export type SellingType = z.infer<typeof SellingType>;

export const Selling = z.object({
  type: SellingType,
  detail: z.string(),
  // Feeds Verdict's dubious check — never its own card badge.
  compromisesContent: z.boolean(),
});
export type Selling = z.infer<typeof Selling>;
