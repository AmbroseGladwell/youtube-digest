export interface ChatOfferContext {
  signedIn: boolean;
  // A shared overview the reader is reading but hasn't saved.
  sharedUnsaved: boolean;
  // The server holds a revision of it: answers are made there, from its copy.
  synced: boolean;
}

// Hidden, never disabled, wherever asking can't work: signed out, on someone else's shared
// overview, and on one still waiting to sync. An article or a recipe page is answered from its
// overview (OV-320). A video or episode without a kept transcript is only known when the server
// says so, and the panel hides then (docs/features/chats.md, "No transcript, no chat").
export const chatOffered = ({ signedIn, sharedUnsaved, synced }: ChatOfferContext): boolean => signedIn && !sharedUnsaved && synced;
