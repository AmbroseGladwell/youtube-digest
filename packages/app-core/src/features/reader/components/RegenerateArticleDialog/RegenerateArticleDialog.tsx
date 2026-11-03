import { useEffect, useRef } from "react";
import styles from "./RegenerateArticleDialog.module.scss";
import { regenerateArticleDialogTestIds } from "./RegenerateArticleDialogTestIds.js";

export interface RegenerateArticleDialogProps {
  url: string;
  onClose: () => void;
}

const HEADING_ID = "RegenerateArticleDialog-heading";

// Design 77au: we keep no copy of an article, so regenerating needs it open beside the panel.
export function RegenerateArticleDialog({ url, onClose }: RegenerateArticleDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      data-testid={regenerateArticleDialogTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 className={styles.heading} id={HEADING_ID}>
          Regenerating reads the article again
        </h2>
        <p className={styles.body}>
          We don’t keep a copy of it, so it needs to be open in Chrome. Open it, then press Regenerate in the side panel. Your
          current overview stays until the new one is ready.
        </p>
        <div className={styles.foot}>
          <button type="button" className={styles.quietAction} onClick={onClose} data-testid={regenerateArticleDialogTestIds.cancelButton}>
            Cancel
          </button>
          <a
            className={styles.primaryAction}
            href={url}
            target="_blank"
            rel="noopener"
            onClick={onClose}
            data-testid={regenerateArticleDialogTestIds.openButton}
          >
            Open the article in a new tab
          </a>
        </div>
      </div>
    </dialog>
  );
}
