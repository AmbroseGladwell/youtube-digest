import type { SessionInfo } from "@overview/domain";
import { createFetchAuthApi } from "@overview/sync";
import { readSyncConnection, writeSyncConnection } from "../sync/syncConnectionStorage.js";
import { isConnected, type SyncConnection } from "../sync/types/SyncConnection.js";
import { adoptReadingPositions } from "../transcripts/readingPositionStorage.js";

export interface AdoptSignedInLibraryOptions {
  // The shell's own: copies the device's one library into the account's and empties it.
  moveDatabase: (accountId: string) => Promise<void>;
  storage?: Storage;
  readSession?: (connection: SyncConnection & { apiUrl: string }) => Promise<SessionInfo>;
  timeoutMs?: number;
}

const ASK_LIMIT_MS = 5_000;

// Before the app opens a library: an install signed in before accounts had libraries of
// their own learns whose session it holds and moves its library under that account, once.
// If the server can't say (offline, or the session ended), nothing changes and the next
// start asks again (docs/features/account-libraries.md, "Installs already signed in").
export async function adoptSignedInLibrary({
  moveDatabase,
  storage = globalThis.localStorage,
  readSession = ({ apiUrl, token }) => createFetchAuthApi({ baseUrl: apiUrl, token }).session(),
  timeoutMs = ASK_LIMIT_MS,
}: AdoptSignedInLibraryOptions): Promise<string | null> {
  const connection = readSyncConnection(storage);
  if (!isConnected(connection) || connection.accountId !== null) return null;

  const limit = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const session = await Promise.race([readSession(connection).catch(() => null), limit]);
  if (session === null) return null;

  await moveDatabase(session.accountId);

  const now = readSyncConnection(storage);
  if (now.apiUrl !== connection.apiUrl || now.accountId !== null) return null;
  writeSyncConnection({ ...now, accountId: session.accountId }, storage);
  adoptReadingPositions(session.accountId, storage);
  return session.accountId;
}
