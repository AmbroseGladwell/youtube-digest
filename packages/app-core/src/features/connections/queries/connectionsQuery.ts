import { queryOptions, useQuery } from "@tanstack/react-query";
import { canConnectAssistant } from "@overview/domain";
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

// Only an account whose plan allows connecting has connections to list (docs/features/mcp-connector.md, "Plus").
export function useConnectionsQuery() {
  const { connection } = useSyncConnection();
  const session = useSessionQuery();
  const api = useConnectionsApi();
  return useQuery(connectionsQueryOptions(connection.email, api, session.data !== undefined && canConnectAssistant(session.data.plan)));
}
