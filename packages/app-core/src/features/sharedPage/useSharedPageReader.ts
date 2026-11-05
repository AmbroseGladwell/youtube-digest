import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useSync } from "../sync/SyncContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

export interface SharedPageReader {
  // Signed in, with the account's own library the one open: the page then offers the way
  // back to their overviews rather than the way to an account (docs/features/sharing.md,
  // "A reader who is signed in").
  signedIn: boolean;
}

export function useSharedPageReader(): SharedPageReader {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const openLibraryAccountId = useLibraryAccountId();
  const accountId = libraryAccountIdOf(connection);
  return { signedIn: sync.connected && accountId !== null && openLibraryAccountId === accountId };
}
