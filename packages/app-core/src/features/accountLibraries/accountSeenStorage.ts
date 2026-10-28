const STORAGE_KEY = "overview.accountSeen.v1";

// Whether this device has been signed in to an account, so the panel signed out offers the way
// back into it rather than onboarding's Start (design 46q). Only that it happened, never whose.
export function readAccountSeen(storage: Storage = globalThis.localStorage): boolean {
  try {
    return storage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markAccountSeen(storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, "true");
  } catch {
    return;
  }
}
