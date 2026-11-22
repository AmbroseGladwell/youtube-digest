import { z } from "zod";

// Device local, since a session is a secret; the web app's session is a cookie, so its token is null.
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

export const isConnected = (connection: SyncConnection): connection is SyncConnection & { apiUrl: string } => connection.apiUrl !== null;

export const libraryAccountIdOf = (connection: SyncConnection): string | null => (isConnected(connection) ? connection.accountId : null);
