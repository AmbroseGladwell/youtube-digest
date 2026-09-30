import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFetchAuthApi, type AuthApi } from "@overview/sync";
import { useSync } from "../../sync/SyncContext.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { authKeys } from "../authKeys.js";

export const sessionQueryOptions = (account: string | null, api: AuthApi | null) =>
  queryOptions({
    queryKey: authKeys.session(account),
    queryFn: () => api!.session(),
    enabled: api !== null,
  });

// Who the server says is signed in, and on which plan. Asked only when this device holds a
// session (docs/features/mcp-connector.md, "Plus").
export function useSessionQuery() {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const { apiUrl, token, email } = connection;
  const api = useMemo(
    () => (sync.connected && apiUrl !== null ? createFetchAuthApi({ baseUrl: apiUrl, token }) : null),
    [sync.connected, apiUrl, token],
  );
  return useQuery(sessionQueryOptions(email, api));
}
