import { useEffect } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { AuthApi } from "@overview/sync";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { authKeys } from "../authKeys.js";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

export const sessionQueryOptions = (account: string | null, api: AuthApi | null) =>
  queryOptions({
    queryKey: authKeys.session(account),
    queryFn: () => api!.session(),
    enabled: api !== null,
  });

// Who the server says is signed in, and on which plan. Asked only when this device holds a
// session (docs/features/mcp-connector.md, "Plus"). The name and address the server answers
// with are written back to the connection, which is how a change made on another device
// reaches this one (docs/features/account-changes.md).
export function useSessionQuery() {
  const { connection, setConnection } = useSyncConnection();
  const api = useSessionAuthApi();
  const query = useQuery(sessionQueryOptions(connection.accountId, api));
  const answered = query.data;

  useEffect(() => {
    if (answered === undefined || answered.accountId !== connection.accountId) return;
    if (answered.email === connection.email && answered.firstName === connection.firstName) return;
    setConnection({ ...connection, email: answered.email, firstName: answered.firstName });
  }, [answered, connection, setConnection]);

  return query;
}
