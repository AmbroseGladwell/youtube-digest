import { LINK_CODE_TTL_MINUTES, MAGIC_LINK_TTL_MINUTES } from "@overview/domain";
import type { PendingSignIn } from "../types/PendingSignIn.js";

const PENDING_LIFETIME_MS = (MAGIC_LINK_TTL_MINUTES + LINK_CODE_TTL_MINUTES) * 60 * 1000;

// Live until the link is opened at the end of its life and its code used at the end of its own.
export const isPendingSignInLive = (pending: PendingSignIn, now: number): boolean => {
  return now - pending.sentAt < PENDING_LIFETIME_MS;
};
