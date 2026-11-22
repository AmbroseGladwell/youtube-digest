export interface ChatOfferContext {
  signedIn: boolean;
  sharedUnsaved: boolean;
  synced: boolean;
}

// Hidden, not disabled; the no-transcript case: docs/features/chats.md, "No transcript, no chat".
export const chatOffered = ({ signedIn, sharedUnsaved, synced }: ChatOfferContext): boolean => signedIn && !sharedUnsaved && synced;
