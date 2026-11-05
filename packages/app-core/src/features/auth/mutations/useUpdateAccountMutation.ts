import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AccountUpdate, SessionInfo } from "@overview/domain";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { authKeys } from "../authKeys.js";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

// The name, saved at once and written into this device's connection so every screen shows
// it before the server is asked again (docs/features/account-changes.md).
export const useUpdateAccountMutation = () => {
  const api = useSessionAuthApi();
  const queryClient = useQueryClient();
  const { connection, setConnection } = useSyncConnection();
  return useMutation<SessionInfo, Error, AccountUpdate>({
    mutationFn: (update) => api!.updateAccount(update),
    onSuccess: (info) => {
      setConnection({ ...connection, email: info.email, firstName: info.firstName });
      queryClient.setQueryData(authKeys.session(connection.accountId), info);
    },
  });
};
