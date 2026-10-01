import { useMutation } from "@tanstack/react-query";
import type { ConnectionDecided, Plan } from "@overview/domain";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useConnectionsApi } from "../useConnectionsApi.js";

export interface DecideConnectionVariables {
  requestId: string;
  approve: boolean;
  plan: Plan;
}

// The answer goes back to the assistant by a full page load, so the pending state holds
// until the page is gone (design 58c), and the event saying so is sent to outlive it.
export const useDecideConnectionMutation = (
  leaveFor: (url: string) => void = (url) => globalThis.location.assign(url),
) => {
  const api = useConnectionsApi();
  const analytics = useAnalytics();
  return useMutation<ConnectionDecided, Error, DecideConnectionVariables>({
    mutationFn: ({ requestId, approve }) => api!.decide(requestId, approve),
    onSuccess: ({ redirectTo }, { approve, plan }) => {
      if (approve) analytics.consent.approved();
      else analytics.consent.declined({ plan });
      void analytics.flush({ keepalive: true });
      leaveFor(redirectTo);
    },
  });
};
