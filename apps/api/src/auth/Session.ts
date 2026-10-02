import type { AccountId } from "./AccountId.js";

export type SessionTransport = "bearer" | "cookie";

export interface Session {
  id: string;
  accountId: AccountId;
  email: string;
  firstName: string | null;
  expiresAt: string;
  tokenHash: string;
  transport: SessionTransport;
}
