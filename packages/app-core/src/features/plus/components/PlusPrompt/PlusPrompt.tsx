import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import styles from "./PlusPrompt.module.scss";
import { plusPromptTestIds } from "./PlusPromptTestIds.js";

export interface PlusPromptProps {
  onDismiss: () => void;
}

export function PlusPrompt({ onDismiss }: PlusPromptProps) {
  return (
    <div className={styles.root} role="note" data-testid={plusPromptTestIds.root}>
      <div>
        <p className={styles.eyebrow}>Plus</p>
        <p className={styles.body} data-testid={plusPromptTestIds.body}>
          Listening is part of Plus. It also syncs every overview to the web app and your other
          devices.
        </p>
      </div>
      <div className={styles.actions}>
        <Link
          className={styles.primary}
          to={Routes.settings()}
          data-testid={plusPromptTestIds.seePlusLink}
        >
          See what Plus adds
        </Link>
        <button
          type="button"
          className={styles.quiet}
          onClick={onDismiss}
          data-testid={plusPromptTestIds.notNowButton}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
