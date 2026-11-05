import { useMemo } from "react";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

// The auth API for the session this device holds: the extension's bearer, or the web
// app's cookie. Null when this device is not signed in to a server.
export function useSessionAuthApi(): AuthApi | null {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const { apiUrl, token } = connection;
  const surface = useClientSurface();
  return useMemo(
    () => (sync.connected && apiUrl !== null ? createFetchAuthApi({ baseUrl: apiUrl, token, surface }) : null),
    [sync.connected, apiUrl, token, surface],
  );
}
