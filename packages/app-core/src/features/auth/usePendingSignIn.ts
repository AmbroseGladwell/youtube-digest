import { useCallback, useSyncExternalStore } from "react";
import { readPendingSignIn, writePendingSignIn } from "./pendingSignInStorage.js";
import type { PendingSignIn } from "./types/PendingSignIn.js";
import { isPendingSignInLive } from "./util/isPendingSignInLive.js";

export interface UsePendingSignInResult {
  pending: PendingSignIn | null;
  setPending: (pending: PendingSignIn | null) => void;
}

// One shared snapshot, as useSyncConnection keeps: the sign-in page writes it and the
// account menu in the bar has to see the write at once.
const listeners = new Set<() => void>();
let snapshot: PendingSignIn | null | undefined;

const readLive = (): PendingSignIn | null => {
  const pending = readPendingSignIn();
  return pending !== null && isPendingSignInLive(pending, Date.now()) ? pending : null;
};

function getSnapshot(): PendingSignIn | null {
  if (snapshot === undefined) snapshot = readLive();
  return snapshot;
}

function refresh(): void {
  snapshot = readLive();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", refresh);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) globalThis.removeEventListener?.("storage", refresh);
  };
}

export function usePendingSignIn(): UsePendingSignInResult {
  const pending = useSyncExternalStore(subscribe, getSnapshot);

  const setPending = useCallback((next: PendingSignIn | null) => {
    writePendingSignIn(next);
    refresh();
  }, []);

  return { pending, setPending };
}
