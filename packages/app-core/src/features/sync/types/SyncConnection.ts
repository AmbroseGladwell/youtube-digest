import { z } from "zod";

// Where the sync server is and the session that identifies this account to it. Device
// local, like the API keys and for the same reason: a token is a secret, and it is the
// thing that makes syncing possible rather than a thing to sync
// (docs/features/sync-client.md).
export const SyncConnection = z.object({
  apiUrl: z.url().nullable(),
  token: z.string().min(1).nullable(),
});
export type SyncConnection = z.infer<typeof SyncConnection>;

export const DEFAULT_SYNC_CONNECTION: SyncConnection = { apiUrl: null, token: null };

export const isConnected = (connection: SyncConnection): connection is { apiUrl: string; token: string } =>
  connection.apiUrl !== null && connection.token !== null;
