import { z } from "zod";
import { FirstName } from "./FirstName.js";

// The name, changeable without proving an inbox; null clears it (docs/features/account-changes.md).
export const AccountUpdate = z.object({
  firstName: FirstName.nullable(),
});
export type AccountUpdate = z.infer<typeof AccountUpdate>;
