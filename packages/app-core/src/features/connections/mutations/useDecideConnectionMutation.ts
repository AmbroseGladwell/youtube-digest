import { useMutation } from "@tanstack/react-query";
import type { ConnectionDecided } from "@overview/domain";
import { useConnectionsApi } from "../useConnectionsApi.js";

export interface DecideConnectionVariables {
  requestId: string;
  approve: boolean;
}

// The answer goes back to the assistant by a full page load, so the pending state holds
// until the page is gone (design 58c).
export const useDecideConnectionMutation = (
  leaveFor: (url: string) => void = (url) => globalThis.location.assign(url),
) => {
  const api = useConnectionsApi();
  return useMutation<ConnectionDecided, Error, DecideConnectionVariables>({
    mutationFn: ({ requestId, approve }) => api!.decide(requestId, approve),
    onSuccess: ({ redirectTo }) => leaveFor(redirectTo),
  });
};
