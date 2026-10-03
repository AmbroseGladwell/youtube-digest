import { useCallback } from "react";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSync } from "../sync/SyncContext.js";

// Sign-out, counted: the outcome is recorded and sent while the session can still carry it,
// since a signed-out reader sends nothing (docs/architecture/analytics.md, "Who is counted"),
// and a last sync given up on is warned of under the same session.
export function useSignOut(): () => Promise<void> {
  const sync = useSync();
  const analytics = useAnalytics();
  const errors = useErrorReporter();
  return useCallback(
    () =>
      sync.signOut({
        beforeEndingSession: async (outcome) => {
          analytics.account.signOut.finished(outcome);
          if (outcome.timedOut) {
            errors.warn({ name: "signOutSyncGaveUp", pending: outcome.pending, stuck: outcome.stuck });
          }
          await Promise.all([analytics.flush(), errors.flush()]);
        },
      }),
    [sync, analytics, errors],
  );
}
