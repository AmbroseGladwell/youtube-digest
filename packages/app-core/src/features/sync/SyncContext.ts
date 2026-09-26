import { createContext, useContext } from "react";
import { INITIAL_SYNC_STATUS, type SyncStatus } from "@overview/sync";

export interface SyncState {
  // Whether this shell can sync at all. False hides every sync control.
  available: boolean;
  // Whether a server and a token have been given.
  connected: boolean;
  status: SyncStatus;
  syncNow: () => void;
  // Stops syncing and forgets the bookkeeping. The records stay.
  disconnect: () => Promise<void>;
}

const SyncContext = createContext<SyncState>({
  available: false,
  connected: false,
  status: INITIAL_SYNC_STATUS,
  syncNow: () => undefined,
  disconnect: () => Promise.resolve(),
});

export const SyncProvider = SyncContext.Provider;

export function useSync(): SyncState {
  return useContext(SyncContext);
}
