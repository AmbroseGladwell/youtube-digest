import { z } from "zod";

// What this device remembers about accounts, whoever is signed in: whether one has ever
// signed out here, and whether the offer of one was turned down
// (docs/features/account-libraries.md, "What signed out looks like").
export const DeviceAccountHistory = z.object({
  signedOutHere: z.boolean().default(false),
  offerDismissed: z.boolean().default(false),
});
export type DeviceAccountHistory = z.infer<typeof DeviceAccountHistory>;

export const NO_ACCOUNT_HISTORY: DeviceAccountHistory = { signedOutHere: false, offerDismissed: false };
