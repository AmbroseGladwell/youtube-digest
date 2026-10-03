import type { SignOutNotice } from "../types/SignOutNotice.js";
import type { SignOutOutcome } from "../types/SignOutOutcome.js";

export function signOutNoticeFor({ pending, stuck, offline }: SignOutOutcome): SignOutNotice | null {
  return pending === 0 && stuck === 0 ? null : { pending, stuck, offline };
}
