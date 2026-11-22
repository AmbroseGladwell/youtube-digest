import { createContext, useContext } from "react";
import type { OverviewFold, StoredTranscript, VideoId } from "@overview/domain";
import { INITIAL_SYNC_STATUS, type SyncStatus } from "@overview/sync";
import type { SignOutNotice } from "./types/SignOutNotice.js";
import type { SignOutOptions } from "./types/SignOutOutcome.js";

export interface SyncState {
  // False where this shell cannot sync at all, and every sync control hides.
  available: boolean;
  connected: boolean;
  status: SyncStatus;
  syncNow: () => void;
  // Always completes, whatever the server answers: docs/features/account-libraries.md, "Sign-out".
  signOut: (options?: SignOutOptions) => Promise<void>;
  signingOut: boolean;
  // No last cycle, since a deleted account has nothing left to send to.
  leaveDeletedAccount: () => void;
  signOutNotice: SignOutNotice | null;
  dismissSignOutNotice: () => void;
  // Just signed in, and the account's library has not finished its first cycle.
  opening: boolean;
  // Null when not signed in.
  fetchTranscript: ((videoId: VideoId) => Promise<StoredTranscript | null>) | null;
  // Latest last: docs/features/one-overview-per-video.md, "The client resolves the refusal".
  folds: OverviewFold[];
  foldNotice: OverviewFold | null;
  dismissFoldNotice: () => void;
}

const SyncContext = createContext<SyncState>({
  available: false,
  connected: false,
  status: INITIAL_SYNC_STATUS,
  syncNow: () => undefined,
  signOut: () => Promise.resolve(),
  signingOut: false,
  leaveDeletedAccount: () => undefined,
  signOutNotice: null,
  dismissSignOutNotice: () => undefined,
  opening: false,
  fetchTranscript: null,
  folds: [],
  foldNotice: null,
  dismissFoldNotice: () => undefined,
});

export const SyncProvider = SyncContext.Provider;

export const useSync = (): SyncState => {
  return useContext(SyncContext);
};
