import type { AccountId } from "./AccountId.js";

export interface Session {
  accountId: AccountId;
  email: string;
  expiresAt: string;
  tokenHash: string;
}
