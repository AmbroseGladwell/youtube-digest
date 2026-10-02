import { z } from "zod";

// Where the sync server is and the session that identifies this account to it. Device
// local, like the API keys and for the same reason: a session is a secret, and it is the
// thing that makes syncing possible rather than a thing to sync. A token is the
// extension's session; the web app's is a cookie the browser holds, so it stores none
// (docs/features/sync-client.md, docs/features/sign-in.md).
export const SyncConnection = z.object({
  apiUrl: z.url().nullable(),
  token: z.string().min(1).nullable(),
  accountId: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  firstName: z.string().nullable().default(null),
});
export type SyncConnection = z.infer<typeof SyncConnection>;
export type SyncConnectionInput = z.input<typeof SyncConnection>;

export const DEFAULT_SYNC_CONNECTION: SyncConnection = {
  apiUrl: null,
  token: null,
  accountId: null,
  email: null,
  firstName: null,
};

export const isConnected = (
  connection: SyncConnection,
): connection is SyncConnection & { apiUrl: string } => connection.apiUrl !== null;

// Which library this device shows: the signed-in account's, or the no-account one
// (docs/features/account-libraries.md).
export const libraryAccountIdOf = (connection: SyncConnection): string | null =>
  isConnected(connection) ? connection.accountId : null;
