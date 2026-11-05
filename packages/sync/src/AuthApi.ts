import type {
  AccountUpdate,
  EmailChangeAsked,
  EmailChangeReverted,
  LinkCode,
  LinkedSession,
  MagicLinkRequest,
  SessionInfo,
  SignedIn,
  VerificationAsked,
} from "@overview/domain";

// The sign-in surface, one method per route, separate from SyncApi because the outbox
// never maps onto it: these are the calls a reader makes once (docs/features/sign-in.md).
// The account's own changes sit beside them (docs/features/account-changes.md).
export interface AuthApi {
  requestMagicLink(request: MagicLinkRequest): Promise<void>;
  signIn(token: string): Promise<SignedIn>;
  signInWithEmailCode(email: string, code: string): Promise<SignedIn>;
  exchangeLinkCode(code: string): Promise<LinkedSession>;
  session(): Promise<SessionInfo>;
  issueLinkCode(): Promise<LinkCode>;
  signOut(): Promise<void>;
  updateAccount(update: AccountUpdate): Promise<SessionInfo>;
  requestVerification(): Promise<VerificationAsked>;
  confirmVerification(code: string): Promise<void>;
  requestEmailChange(email: string): Promise<EmailChangeAsked>;
  confirmEmailChange(code: string): Promise<SessionInfo>;
  revertEmailChange(token: string): Promise<EmailChangeReverted>;
}
