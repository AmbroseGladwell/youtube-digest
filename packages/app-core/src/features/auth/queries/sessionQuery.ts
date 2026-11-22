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

// The answer's name and address are written back, which is how another device's change reaches this one.
export const useSessionQuery = () => {
  const { connection, setConnection } = useSyncConnection();
  const api = useSessionAuthApi();
  const query = useQuery(sessionQueryOptions(connection.accountId, api));
  const answered = query.data;

  useEffect(() => {
    if (answered === undefined || answered.accountId !== connection.accountId) {
      return;
    }
    if (answered.email === connection.email && answered.firstName === connection.firstName) {
      return;
    }
    setConnection({ ...connection, email: answered.email, firstName: answered.firstName });
  }, [answered, connection, setConnection]);

  return query;
};
