import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { ShareToken } from "./shareLink.js";

// Asked first, so the sync push of the new overview is let in (docs/architecture/tiers.md).
export const OverviewReservationRequest = z.object({
  overviewId: OverviewId,
  shareToken: ShareToken.optional(),
});
export type OverviewReservationRequest = z.infer<typeof OverviewReservationRequest>;
