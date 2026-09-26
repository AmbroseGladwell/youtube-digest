import type { Handshake } from "@overview/domain";

// idle and syncing are the working states. The other four are why the last cycle stopped,
// each with a different way out: offline and failed resolve on their own with a retry,
// signedOut needs a token, unsupported needs an update and is the wall
// (docs/features/record-migrations.md, docs/features/sync-client.md).
export type SyncPhase = "idle" | "syncing" | "offline" | "failed" | "signedOut" | "unsupported";

export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  stuck: number;
  lastSyncedAt: string | null;
  handshake: Handshake | null;
  detail: string | null;
}

export const INITIAL_SYNC_STATUS: SyncStatus = {
  phase: "idle",
  pending: 0,
  stuck: 0,
  lastSyncedAt: null,
  handshake: null,
  detail: null,
};
