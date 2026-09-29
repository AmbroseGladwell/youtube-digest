import type { AccountId } from "./AccountId.js";

export type SessionTransport = "bearer" | "cookie";

export interface Session {
  accountId: AccountId;
  email: string;
  firstName: string | null;
  expiresAt: string;
  tokenHash: string;
  transport: SessionTransport;
}
