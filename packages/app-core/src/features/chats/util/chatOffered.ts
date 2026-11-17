import type { Overview } from "@overview/domain";

export interface ChatOfferContext {
  signedIn: boolean;
  // A shared overview the reader is reading but hasn't saved.
  sharedUnsaved: boolean;
}

// Hidden, never disabled, wherever asking can't work: signed out, on someone else's shared
// overview, and for an article or recipe page, whose text the server doesn't keep. A video or
// episode without a kept transcript is only known when the server says so, and the panel hides
// then (docs/features/chats.md, "No transcript, no chat").
export const chatOffered = (overview: Pick<Overview, "source">, { signedIn, sharedUnsaved }: ChatOfferContext): boolean =>
  signedIn && !sharedUnsaved && overview.source.kind !== "web";
