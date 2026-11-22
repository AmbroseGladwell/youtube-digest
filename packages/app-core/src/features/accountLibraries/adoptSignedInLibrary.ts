import type { SessionInfo } from "@overview/domain";
import { createFetchAuthApi } from "@overview/sync";
import type { Surface } from "../../app/SurfaceContext.js";
import { readSyncConnection, writeSyncConnection } from "../sync/syncConnectionStorage.js";
import { isConnected, type SyncConnection } from "../sync/types/SyncConnection.js";
import { adoptReadingPositions } from "../transcripts/readingPositionStorage.js";

export interface AdoptSignedInLibraryOptions {
  moveDatabase: (accountId: string) => Promise<void>;
  surface: Surface;
  storage?: Storage;
  readSession?: (connection: SyncConnection & { apiUrl: string }) => Promise<SessionInfo>;
  timeoutMs?: number;
}

const ASK_LIMIT_MS = 5_000;

// Runs once; offline it waits: docs/features/account-libraries.md, "Installs already signed in".
export const adoptSignedInLibrary = async ({
  moveDatabase,
  surface,
  storage = globalThis.localStorage,
  readSession = ({ apiUrl, token }) => createFetchAuthApi({ baseUrl: apiUrl, token, surface }).session(),
  timeoutMs = ASK_LIMIT_MS,
}: AdoptSignedInLibraryOptions): Promise<string | null> => {
  const connection = readSyncConnection(storage);
  if (!isConnected(connection) || connection.accountId !== null) {
    return null;
  }

  const limit = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const session = await Promise.race([readSession(connection).catch(() => null), limit]);
  if (session === null) {
    return null;
  }

  await moveDatabase(session.accountId);

  const now = readSyncConnection(storage);
  if (now.apiUrl !== connection.apiUrl || now.accountId !== null) {
    return null;
  }
  writeSyncConnection({ ...now, accountId: session.accountId }, storage);
  adoptReadingPositions(session.accountId, storage);
  return session.accountId;
};
