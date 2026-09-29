import { LINK_CODE_TTL_MINUTES, MAGIC_LINK_TTL_MINUTES } from "@overview/domain";
import type { PendingSignIn } from "../types/PendingSignIn.js";

const PENDING_LIFETIME_MS = (MAGIC_LINK_TTL_MINUTES + LINK_CODE_TTL_MINUTES) * 60 * 1000;

// The last moment a code from this link could still be typed: the link opened at the end
// of its life, and the code it showed used at the end of its own.
export function isPendingSignInLive(pending: PendingSignIn, now: number): boolean {
  return now - pending.sentAt < PENDING_LIFETIME_MS;
}
