import type { SyncStatus } from "@overview/sync";
import type { SignOutNotice } from "../types/SignOutNotice.js";

export function signOutNoticeFor(status: SyncStatus, online: boolean): SignOutNotice | null {
  if (status.pending === 0 && status.stuck === 0) return null;
  return { pending: status.pending, stuck: status.stuck, offline: !online || status.phase === "offline" };
}
