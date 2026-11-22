import { useCallback } from "react";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSync } from "../sync/SyncContext.js";
import { usePlayer } from "../player/PlayerContext.js";

// Counted first, as signed out sends nothing: docs/architecture/analytics.md, "Who is counted".
export const useSignOut = (): (() => Promise<void>) => {
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
};
