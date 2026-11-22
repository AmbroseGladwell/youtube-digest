import { useMemo } from "react";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useClientSurface } from "../../app/SurfaceContext.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

export const useSessionAuthApi = (): AuthApi | null => {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const { apiUrl, token } = connection;
  const surface = useClientSurface();
  return useMemo(
    () => (sync.connected && apiUrl !== null ? createFetchAuthApi({ baseUrl: apiUrl, token, surface }) : null),
    [sync.connected, apiUrl, token, surface],
  );
};
