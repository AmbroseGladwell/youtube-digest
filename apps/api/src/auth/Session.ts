import type { AccountId } from "./AccountId.js";

export type SessionTransport = "bearer" | "cookie";

export interface Session {
  accountId: AccountId;
  email: string;
  expiresAt: string;
  tokenHash: string;
  transport: SessionTransport;
}
