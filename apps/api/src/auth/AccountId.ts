import { z } from "zod";

// Here, not in @overview/domain: the clients share no account type yet.
export const AccountId = z.uuid().brand("AccountId");
export type AccountId = z.infer<typeof AccountId>;
