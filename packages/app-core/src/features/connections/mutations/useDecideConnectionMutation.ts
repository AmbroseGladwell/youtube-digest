import { useMutation } from "@tanstack/react-query";
import type { ConnectionDecided, Plan } from "@overview/domain";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useConnectionsApi } from "../useConnectionsApi.js";

export interface DecideConnectionVariables {
  requestId: string;
  approve: boolean;
  plan: Plan;
}

// Pending holds until the full page load leaves, and the event is sent to outlive the page.
export const useDecideConnectionMutation = (leaveFor: (url: string) => void = (url) => globalThis.location.assign(url)) => {
  const api = useConnectionsApi();
  const analytics = useAnalytics();
  return useMutation<ConnectionDecided, Error, DecideConnectionVariables>({
    mutationFn: ({ requestId, approve }) => api!.decide(requestId, approve),
    onSuccess: ({ redirectTo }, { approve, plan }) => {
      if (approve) {
        analytics.mcp.consentScreen.approved();
      } else {
        analytics.mcp.consentScreen.declined({ plan });
      }
      void analytics.flush({ keepalive: true });
      leaveFor(redirectTo);
    },
  });
};
