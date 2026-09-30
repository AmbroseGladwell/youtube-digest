import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ConnectionsApi } from "@overview/sync";
import { useSessionQuery } from "../../auth/queries/sessionQuery.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { connectionKeys } from "../connectionKeys.js";
import { useConnectionsApi } from "../useConnectionsApi.js";

export const connectionsQueryOptions = (account: string | null, api: ConnectionsApi | null, enabled: boolean) =>
  queryOptions({
    queryKey: connectionKeys.list(account),
    queryFn: () => api!.list(),
    enabled: enabled && api !== null,
  });

// Only a Plus account has connections to list (docs/features/mcp-connector.md, "Plus").
export function useConnectionsQuery() {
  const { connection } = useSyncConnection();
  const session = useSessionQuery();
  const api = useConnectionsApi();
  return useQuery(connectionsQueryOptions(connection.email, api, session.data?.plan === "plus"));
}
