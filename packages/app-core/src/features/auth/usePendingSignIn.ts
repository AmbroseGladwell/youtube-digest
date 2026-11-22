import { useCallback, useSyncExternalStore } from "react";
import { readPendingSignIn, writePendingSignIn } from "./pendingSignInStorage.js";
import type { PendingSignIn } from "./types/PendingSignIn.js";
import { isPendingSignInLive } from "./util/isPendingSignInLive.js";

export interface UsePendingSignInResult {
  pending: PendingSignIn | null;
  setPending: (pending: PendingSignIn | null) => void;
}

// One shared snapshot, so the account menu sees the sign-in page's write at once.
const listeners = new Set<() => void>();
let snapshot: PendingSignIn | null | undefined;

const readLive = (): PendingSignIn | null => {
  const pending = readPendingSignIn();
  return pending !== null && isPendingSignInLive(pending, Date.now()) ? pending : null;
};

const getSnapshot = (): PendingSignIn | null => {
  if (snapshot === undefined) {
    snapshot = readLive();
  }
  return snapshot;
};

const refresh = (): void => {
  snapshot = readLive();
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", refresh);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      globalThis.removeEventListener?.("storage", refresh);
    }
  };
};

export const usePendingSignIn = (): UsePendingSignInResult => {
  const pending = useSyncExternalStore(subscribe, getSnapshot);

  const setPending = useCallback((next: PendingSignIn | null) => {
    writePendingSignIn(next);
    refresh();
  }, []);

  return { pending, setPending };
};
