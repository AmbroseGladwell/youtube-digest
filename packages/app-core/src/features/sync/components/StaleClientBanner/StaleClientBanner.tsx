import { useState } from "react";
import { useAppUpdate } from "../../../../app/AppUpdateContext.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useUnreadableRecordsQuery } from "../../queries/unreadableRecordsQuery.js";
import styles from "./StaleClientBanner.module.scss";
import { staleClientBannerTestIds } from "./StaleClientBannerTestIds.js";

// Fires on encounter, not on the handshake: only when records are actually being held
// back. Dismissed for the session and no longer, because what it reports is the reader's
// own data being invisible (docs/features/record-migrations.md).
export function StaleClientBanner() {
  const surface = useSurface();
  const appUpdate = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);
  const records = useUnreadableRecordsQuery().data ?? [];
  const heldBack = records.filter((record) => record.reason === "future-version");

  if (dismissed || heldBack.length === 0) {
    return null;
  }

  const noun = heldBack.every((record) => record.kind === "overview") ? "overview" : "record";
  const count = heldBack.length;
  const action =
    surface === "web"
      ? { label: "Reload", apply: () => globalThis.location.reload() }
      : appUpdate;

  return (
    <div className={styles.root} role="status" aria-live="polite" data-testid={staleClientBannerTestIds.root}>
      <div className={styles.row}>
        <span className={styles.message} data-testid={staleClientBannerTestIds.message}>
          {count} {count === 1 ? `${noun} needs` : `${noun}s need`} a newer version of the app
        </span>
        {action !== null && (
          <button
            type="button"
            className={styles.updateButton}
            onClick={action.apply}
            data-testid={staleClientBannerTestIds.updateButton}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          className={styles.dismissButton}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          data-testid={staleClientBannerTestIds.dismissButton}
        >
          ×
        </button>
      </div>
    </div>
  );
}
