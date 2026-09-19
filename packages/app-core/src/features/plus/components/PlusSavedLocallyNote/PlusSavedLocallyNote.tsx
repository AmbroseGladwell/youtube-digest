import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import styles from "./PlusSavedLocallyNote.module.scss";
import { plusSavedLocallyNoteTestIds } from "./PlusSavedLocallyNoteTestIds.js";

export interface PlusSavedLocallyNoteProps {
  onDismiss: () => void;
}

export function PlusSavedLocallyNote({ onDismiss }: PlusSavedLocallyNoteProps) {
  return (
    <div className={styles.root} role="note" data-testid={plusSavedLocallyNoteTestIds.root}>
      <p className={styles.body}>
        <strong className={styles.lede}>Saved on this browser only.</strong> Plus syncs your
        overviews to the web app and your other devices, and unlocks audio overviews.
      </p>
      <div className={styles.actions}>
        <Link
          className={styles.link}
          to={Routes.settings()}
          data-testid={plusSavedLocallyNoteTestIds.seePlusLink}
        >
          See Plus →
        </Link>
        <button
          type="button"
          className={styles.quiet}
          onClick={onDismiss}
          data-testid={plusSavedLocallyNoteTestIds.dismissButton}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
