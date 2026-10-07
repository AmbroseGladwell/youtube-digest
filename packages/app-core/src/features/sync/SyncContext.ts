import { createContext, useContext } from "react";
import type { OverviewFold, StoredTranscript, VideoId } from "@overview/domain";
import { INITIAL_SYNC_STATUS, type SyncStatus } from "@overview/sync";
import type { SignOutNotice } from "./types/SignOutNotice.js";
import type { SignOutOptions } from "./types/SignOutOutcome.js";

export interface SyncState {
  // Whether this shell can sync at all. False hides every sync control.
  available: boolean;
  // Whether this device is signed in to a server.
  connected: boolean;
  status: SyncStatus;
  syncNow: () => void;
  // Runs one last cycle, tells the server to end the session, then signs this device out
  // whether or not it answered (docs/features/account-libraries.md).
  signOut: (options?: SignOutOptions) => Promise<void>;
  signingOut: boolean;
  // What the last sign-out could not send, until the reader dismisses it.
  signOutNotice: SignOutNotice | null;
  dismissSignOutNotice: () => void;
  // Just signed in, and the account's library has not finished its first cycle.
  opening: boolean;
  // Asks the server for a transcript this device does not hold. Null when not signed in.
  fetchTranscript: ((videoId: VideoId) => Promise<StoredTranscript | null>) | null;
  // Overviews made on this device that were folded into the account's copy of the same
  // video since this tab opened, latest last, so an open page can follow and the reader
  // can be told (docs/features/one-overview-per-video.md).
  folds: OverviewFold[];
  // The latest fold the reader has not yet been told about.
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
  signOutNotice: null,
  dismissSignOutNotice: () => undefined,
  opening: false,
  fetchTranscript: null,
  folds: [],
  foldNotice: null,
  dismissFoldNotice: () => undefined,
});

export const SyncProvider = SyncContext.Provider;

export function useSync(): SyncState {
  return useContext(SyncContext);
}
