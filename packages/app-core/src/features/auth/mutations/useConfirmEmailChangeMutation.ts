import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionInfo } from "@overview/domain";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { authKeys } from "../authKeys.js";
import { useSessionAuthApi } from "../useSessionAuthApi.js";

// The code from the new address. The account has moved once this answers, so the
// connection is written before anything else reads it (docs/features/account-changes.md).
export const useConfirmEmailChangeMutation = () => {
  const api = useSessionAuthApi();
  const queryClient = useQueryClient();
  const { connection, setConnection } = useSyncConnection();
  return useMutation<SessionInfo, Error, string>({
    mutationFn: (code) => api!.confirmEmailChange(code),
    onSuccess: (info) => {
      setConnection({ ...connection, email: info.email, firstName: info.firstName });
      queryClient.setQueryData(authKeys.session(connection.accountId), info);
    },
  });
};
