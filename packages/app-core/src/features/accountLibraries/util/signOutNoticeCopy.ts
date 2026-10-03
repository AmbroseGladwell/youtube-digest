import type { Surface } from "../../../app/SurfaceContext.js";
import type { SignOutNotice } from "../../sync/types/SignOutNotice.js";
import { signingInHere } from "./libraryPlace.js";

export interface SignOutNoticeCopy {
  lead: string;
  then: string | null;
  stuck: string | null;
}

const changes = (count: number): string => (count === 1 ? "1 change" : `${count} changes`);

// Designs 47d-2 and 47d-3: what is waiting leads, the reason first when it is known, and
// what the server refused is its own line because nothing will send it.
export function signOutNoticeCopy({ pending, stuck, offline }: SignOutNotice, surface: Surface): SignOutNoticeCopy {
  const here = signingInHere(surface);
  let lead: string;
  let then: string | null = null;
  if (pending === 0) {
    lead = offline ? "Signed out while offline." : "Signed out.";
  } else if (offline) {
    lead = `Signed out while offline. ${changes(pending)} ${pending === 1 ? "hasn’t" : "haven’t"} synced to your account yet.`;
    then = `${pending === 1 ? "It’ll" : "They’ll"} sync next time you sign in ${here}.`;
  } else {
    lead = `Signed out. ${changes(pending)} will sync when you sign back in ${here}.`;
  }
  const stuckLine =
    stuck === 0
      ? null
      : `${pending === 0 ? changes(stuck) : `${stuck} more`} couldn’t be sent and won’t retry on ${stuck === 1 ? "its" : "their"} own. You’ll see ${stuck === 1 ? "it" : "them"} in Account & sync when you sign in.`;
  return { lead, then, stuck: stuckLine };
}
