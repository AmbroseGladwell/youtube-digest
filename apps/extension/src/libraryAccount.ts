import { z } from "zod";

const LIBRARY_ACCOUNT = "overview/library-account";

const StoredLibraryAccount = z.string().nullable();

// The worker has no localStorage to read the connection from, so the pages tell it which
// library they have open (docs/features/account-libraries.md).
export const writeLibraryAccount = (accountId: string | null): Promise<void> =>
  chrome.storage.local.set({ [LIBRARY_ACCOUNT]: accountId }).catch(() => undefined);

export async function readLibraryAccount(): Promise<string | null> {
  try {
    const stored = await chrome.storage.local.get(LIBRARY_ACCOUNT);
    return StoredLibraryAccount.catch(null).parse(stored[LIBRARY_ACCOUNT] ?? null);
  } catch {
    return null;
  }
}

export function onLibraryAccountChanged(listener: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && LIBRARY_ACCOUNT in changes) listener();
  });
}
