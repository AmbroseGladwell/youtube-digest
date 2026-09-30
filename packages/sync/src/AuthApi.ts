import type { LinkCode, LinkedSession, MagicLinkRequest, SessionInfo, SignedIn } from "@overview/domain";

// The sign-in surface, one method per route, separate from SyncApi because the outbox
// never maps onto it: these are the calls a reader makes once (docs/features/sign-in.md).
export interface AuthApi {
  requestMagicLink(request: MagicLinkRequest): Promise<void>;
  signIn(token: string): Promise<SignedIn>;
  exchangeLinkCode(code: string): Promise<LinkedSession>;
  session(): Promise<SessionInfo>;
  issueLinkCode(): Promise<LinkCode>;
  signOut(): Promise<void>;
}
