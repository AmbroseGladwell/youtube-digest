import { z } from "zod";
import { FirstName } from "./FirstName.js";

// What a signed-in reader can change about their account without proving an inbox: the
// name. Null clears it, and every screen falls back to the address
// (docs/features/account-changes.md).
export const AccountUpdate = z.object({
  firstName: FirstName.nullable(),
});
export type AccountUpdate = z.infer<typeof AccountUpdate>;
