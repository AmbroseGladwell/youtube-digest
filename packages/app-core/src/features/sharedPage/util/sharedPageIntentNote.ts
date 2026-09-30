import type { SharedPageIntent } from "../types/SharedPageIntent.js";

export interface SharedPageIntentNote {
  label: string;
  body: string;
}

// Design 30l: what confirming the account will finish, said before they confirm it, so
// the email they are about to open has a point (docs/features/sharing.md).
export function sharedPageIntentNote(intent: SharedPageIntent | null): SharedPageIntentNote | null {
  if (intent === null) {
    return null;
  }
  return intent.kind === "save"
    ? { label: "Saving", body: `${intent.title}, into your library once you’ve confirmed.` }
    : { label: "Making an overview", body: "Of the link you pasted, once you’ve confirmed." };
}
