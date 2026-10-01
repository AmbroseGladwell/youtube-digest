import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Connection } from "@overview/domain";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { connectionKeys } from "../connectionKeys.js";
import { useConnectionsApi } from "../useConnectionsApi.js";

interface RevokeConnectionContext {
  previous: Array<[readonly unknown[], Connection[] | undefined]>;
}

// Revoking cuts the assistant off on its next request, so the row goes at once and comes
// back only if the server refused (docs/features/mcp-connector.md, "Tokens").
export const useRevokeConnectionMutation = () => {
  const api = useConnectionsApi();
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const lists = [...connectionKeys.all, "list"];

  return useMutation<void, Error, string, RevokeConnectionContext>({
    mutationKey: connectionKeys.all,
    mutationFn: (connectionId) => api!.revoke(connectionId),
    onMutate: async (connectionId) => {
      await queryClient.cancelQueries({ queryKey: lists });
      const previous = queryClient.getQueriesData<Connection[]>({ queryKey: lists });
      queryClient.setQueriesData<Connection[]>({ queryKey: lists }, (connections) =>
        connections?.filter((connection) => connection.id !== connectionId),
      );
      return { previous };
    },
    onSuccess: () => analytics.mcp.settingsConnections.revoked(),
    onError: (_error, _connectionId, context) => {
      for (const [queryKey, data] of context?.previous ?? []) queryClient.setQueryData(queryKey, data);
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: connectionKeys.all }) === 1) {
        await queryClient.invalidateQueries({ queryKey: lists });
      }
    },
  });
};
