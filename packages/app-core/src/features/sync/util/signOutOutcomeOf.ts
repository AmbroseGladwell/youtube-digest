import type { SyncStatus } from "@overview/sync";
import type { SignOutOutcome } from "../types/SignOutOutcome.js";

export function signOutOutcomeOf(status: SyncStatus, { online, timedOut }: { online: boolean; timedOut: boolean }): SignOutOutcome {
  return {
    pending: status.pending,
    stuck: status.stuck,
    offline: !online || status.phase === "offline",
    timedOut,
  };
}
