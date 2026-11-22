import type { Handshake } from "@overview/domain";

// Each stopped phase's way out: docs/features/sync-client.md, "What stops a cycle and what parks a write".
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
