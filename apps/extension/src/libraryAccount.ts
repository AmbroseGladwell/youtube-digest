import { z } from "zod";

const LIBRARY_ACCOUNT = "overview/library-account";

const StoredLibraryAccount = z.string().nullable();

// The worker has no localStorage, so the pages tell it which library they have open.
export const writeLibraryAccount = (accountId: string | null): Promise<void> =>
  chrome.storage.local.set({ [LIBRARY_ACCOUNT]: accountId }).catch(() => undefined);

export const readLibraryAccount = async (): Promise<string | null> => {
  try {
    const stored = await chrome.storage.local.get(LIBRARY_ACCOUNT);
    return StoredLibraryAccount.catch(null).parse(stored[LIBRARY_ACCOUNT] ?? null);
  } catch {
    return null;
  }
};

export const onLibraryAccountChanged = (listener: () => void): void => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && LIBRARY_ACCOUNT in changes) {
      listener();
    }
  });
};
