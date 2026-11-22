import type { SyncStatus } from "@overview/sync";
import type { SignOutOutcome } from "../types/SignOutOutcome.js";

export interface SignOutOutcomeOfOptions {
  online: boolean;
  timedOut: boolean;
}

export const signOutOutcomeOf = (status: SyncStatus, { online, timedOut }: SignOutOutcomeOfOptions): SignOutOutcome => {
  return {
    pending: status.pending,
    stuck: status.stuck,
    offline: !online || status.phase === "offline",
    timedOut,
  };
};
