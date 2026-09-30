import { SharedPageIntent } from "../types/SharedPageIntent.js";

const STORAGE_KEY = "overview.sharedPageIntent.v1";

// The magic link opens a fresh tab, so this has to outlive the one the visitor started in:
// localStorage rather than session. Validated on read, because a shape written by an
// older build must not crash the account it is confirming
// (docs/conventions/frontend-architecture-guide.md 4.2).
export function rememberSharedPageIntent(
  intent: SharedPageIntent,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // A browser that refuses site data costs the visitor the hand-off, not the account.
  }
}

export function readSharedPageIntent(storage: Storage = globalThis.localStorage): SharedPageIntent | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return SharedPageIntent.safeParse(JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

export function forgetSharedPageIntent(storage: Storage = globalThis.localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // see above
  }
}
