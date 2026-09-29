import { PendingSignIn } from "./types/PendingSignIn.js";

const STORAGE_KEY = "overview.pendingSignIn.v1";

export function readPendingSignIn(storage: Storage = globalThis.localStorage): PendingSignIn | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = PendingSignIn.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writePendingSignIn(
  pending: PendingSignIn | null,
  storage: Storage = globalThis.localStorage,
): void {
  if (pending === null) {
    storage.removeItem(STORAGE_KEY);
  } else {
    storage.setItem(STORAGE_KEY, JSON.stringify(pending));
  }
}
