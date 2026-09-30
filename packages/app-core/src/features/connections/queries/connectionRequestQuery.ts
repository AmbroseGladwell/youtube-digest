import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ConnectionsApi } from "@overview/sync";
import { connectionKeys } from "../connectionKeys.js";
import { useConnectionsApi } from "../useConnectionsApi.js";

export const connectionRequestQueryOptions = (requestId: string, api: ConnectionsApi | null) =>
  queryOptions({
    queryKey: connectionKeys.request(requestId),
    queryFn: () => api!.request(requestId),
    enabled: api !== null,
  });

export const useConnectionRequestQuery = (requestId: string) =>
  useQuery(connectionRequestQueryOptions(requestId, useConnectionsApi()));
