import type { SellingType } from "./Selling.js";

export const SELLING_LABEL: Record<SellingType, string> = {
  own_paid_product: "Sells their own paid product",
  own_free_promotion: "Promotes something of theirs, free",
  sponsor_or_affiliate: "Sponsored or affiliate",
  none: "Sells nothing",
};
