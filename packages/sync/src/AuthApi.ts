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
  VerificationPurpose,
} from "@overview/domain";

// Apart from SyncApi because the outbox never maps onto it: these are calls a reader makes once.
export interface AuthApi {
  requestMagicLink(request: MagicLinkRequest): Promise<void>;
  signIn(token: string): Promise<SignedIn>;
  signInWithEmailCode(email: string, code: string): Promise<SignedIn>;
  exchangeLinkCode(code: string): Promise<LinkedSession>;
  session(): Promise<SessionInfo>;
  issueLinkCode(): Promise<LinkCode>;
  signOut(): Promise<void>;
  updateAccount(update: AccountUpdate): Promise<SessionInfo>;
  requestVerification(purpose?: VerificationPurpose): Promise<VerificationAsked>;
  confirmVerification(code: string): Promise<void>;
  requestEmailChange(email: string): Promise<EmailChangeAsked>;
  confirmEmailChange(code: string): Promise<SessionInfo>;
  revertEmailChange(token: string): Promise<EmailChangeReverted>;
  deleteAccount(): Promise<void>;
}
