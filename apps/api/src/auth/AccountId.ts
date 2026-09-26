import { z } from "zod";

// Kept here rather than in @overview/domain: accounts are not something the clients share a
// type for yet (docs/architecture/api.md).
export const AccountId = z.uuid().brand("AccountId");
export type AccountId = z.infer<typeof AccountId>;
