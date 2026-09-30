import type { AccountId } from "../auth/AccountId.js";
import type { TokenResponse } from "./issueTokens.js";

export type TokenGrant =
  | { kind: "issued"; tokens: TokenResponse; connectionId: string; accountId: AccountId; created: boolean }
  | { kind: "refused"; description: string }
  | { kind: "replayed"; connectionId: string | null };
