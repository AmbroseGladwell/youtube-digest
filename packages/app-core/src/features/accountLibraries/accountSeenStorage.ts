const STORAGE_KEY = "overview.accountSeen.v1";

// Only that an account was signed in here, never whose, so signed out can offer the way back in.
export const readAccountSeen = (storage: Storage = globalThis.localStorage): boolean => {
  try {
    return storage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const markAccountSeen = (storage: Storage = globalThis.localStorage): void => {
  try {
    storage.setItem(STORAGE_KEY, "true");
  } catch {
    return;
  }
};
