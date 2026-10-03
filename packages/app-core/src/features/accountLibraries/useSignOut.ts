import { useCallback } from "react";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useSync } from "../sync/SyncContext.js";

// Sign-out, counted: the outcome is recorded and sent while the session can still carry it,
// since a signed-out reader sends nothing (docs/architecture/analytics.md, "Who is counted").
export function useSignOut(): () => Promise<void> {
  const sync = useSync();
  const analytics = useAnalytics();
  return useCallback(
    () =>
      sync.signOut({
        beforeEndingSession: async (outcome) => {
          analytics.account.signOut.finished(outcome);
          await analytics.flush();
        },
      }),
    [sync, analytics],
  );
}
