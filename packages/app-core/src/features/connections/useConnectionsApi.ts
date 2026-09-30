import { useMemo } from "react";
import { createFetchConnectionsApi, type ConnectionsApi } from "@overview/sync";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

export function useConnectionsApi(): ConnectionsApi | null {
  const { connection } = useSyncConnection();
  const knownApiUrl = useKnownApiUrl();
  const baseUrl = connection.apiUrl ?? knownApiUrl;
  const { token } = connection;
  return useMemo(() => (baseUrl === null ? null : createFetchConnectionsApi({ baseUrl, token })), [baseUrl, token]);
}
