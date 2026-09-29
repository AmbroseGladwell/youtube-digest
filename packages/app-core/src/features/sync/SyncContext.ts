import { createContext, useContext } from "react";
import type { StoredTranscript, VideoId } from "@overview/domain";
import { INITIAL_SYNC_STATUS, type SyncStatus } from "@overview/sync";

export interface SyncState {
  // Whether this shell can sync at all. False hides every sync control.
  available: boolean;
  // Whether this device is signed in to a server.
  connected: boolean;
  status: SyncStatus;
  syncNow: () => void;
  // Stops syncing and forgets the bookkeeping. The records stay.
  disconnect: () => Promise<void>;
  // Tells the server to end the session, then disconnects whether or not it answered.
  signOut: () => Promise<void>;
  // Asks the server for a transcript this device does not hold. Null when not signed in.
  fetchTranscript: ((videoId: VideoId) => Promise<StoredTranscript | null>) | null;
}

const SyncContext = createContext<SyncState>({
  available: false,
  connected: false,
  status: INITIAL_SYNC_STATUS,
  syncNow: () => undefined,
  disconnect: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  fetchTranscript: null,
});

export const SyncProvider = SyncContext.Provider;

export function useSync(): SyncState {
  return useContext(SyncContext);
}
