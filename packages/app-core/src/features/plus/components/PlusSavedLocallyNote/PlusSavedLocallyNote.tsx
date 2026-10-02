import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./PlusSavedLocallyNote.module.scss";
import { plusSavedLocallyNoteTestIds } from "./PlusSavedLocallyNoteTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface PlusSavedLocallyNoteProps {
  onDismiss: () => void;
}

export function PlusSavedLocallyNote({ onDismiss }: PlusSavedLocallyNoteProps) {
  const analytics = useAnalytics();
  return (
    <div className={styles.root} role="note" data-testid={plusSavedLocallyNoteTestIds.root}>
      <p className={styles.body}>
        <strong className={styles.lede}>Saved on this browser only.</strong> Plus syncs your
        overviews to the web app and your other devices.
      </p>
      <div className={styles.actions}>
        <Link
          className={styles.link}
          to={Routes.settingsSection("plan")}
          onClick={() => analytics.plus.savedLocallyNote.seePlusChosen()}
          data-testid={plusSavedLocallyNoteTestIds.seePlusLink}
        >
          See Plus <StrokeIcon name="arrowRight" size={13} />
        </Link>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => {
            analytics.plus.savedLocallyNote.dismissed();
            onDismiss();
          }}
          data-testid={plusSavedLocallyNoteTestIds.dismissButton}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
