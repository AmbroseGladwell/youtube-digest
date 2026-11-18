import { useCallback } from "react";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSync } from "../sync/SyncContext.js";
import { usePlayer } from "../player/PlayerContext.js";

// Sign-out, counted: the outcome and any listen it ends are recorded and sent while the
// session can still carry them, since a signed-out reader sends nothing
// (docs/architecture/analytics.md, "Who is counted"), and a last sync given up on is warned
// of under the same session.
export function useSignOut(): () => Promise<void> {
  const sync = useSync();
  const analytics = useAnalytics();
  const errors = useErrorReporter();
  const player = usePlayer();
  return useCallback(
    () =>
      sync.signOut({
        beforeEndingSession: async (outcome) => {
          player.endSession();
          analytics.account.signOut.finished(outcome);
          if (outcome.timedOut) {
            errors.warn({ name: "signOutSyncGaveUp", pending: outcome.pending, stuck: outcome.stuck });
          }
          await Promise.all([analytics.flush(), errors.flush()]);
        },
      }),
    [sync, analytics, errors, player],
  );
}
