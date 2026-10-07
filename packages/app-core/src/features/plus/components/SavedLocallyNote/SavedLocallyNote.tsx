import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./SavedLocallyNote.module.scss";
import { savedLocallyNoteTestIds } from "./SavedLocallyNoteTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface SavedLocallyNoteProps {
  onDismiss: () => void;
}

export function SavedLocallyNote({ onDismiss }: SavedLocallyNoteProps) {
  const analytics = useAnalytics();
  return (
    <div className={styles.root} role="note" data-testid={savedLocallyNoteTestIds.root}>
      <p className={styles.body}>
        <strong className={styles.lede}>Saved on this browser only.</strong> A free account syncs
        your overviews to the web app and your other devices, and reads them aloud.
      </p>
      <div className={styles.actions}>
        <Link
          className={styles.link}
          to={Routes.createAccount()}
          onClick={() => analytics.plus.savedLocallyNote.createAccountChosen()}
          data-testid={savedLocallyNoteTestIds.createAccountLink}
        >
          Create account <StrokeIcon name="arrowRight" size={13} />
        </Link>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => {
            analytics.plus.savedLocallyNote.dismissed();
            onDismiss();
          }}
          data-testid={savedLocallyNoteTestIds.dismissButton}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
