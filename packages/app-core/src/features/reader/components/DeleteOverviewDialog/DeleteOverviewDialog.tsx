import { useEffect, useRef } from "react";
import styles from "./DeleteOverviewDialog.module.scss";
import { deleteOverviewDialogTestIds } from "./DeleteOverviewDialogTestIds.js";

export interface DeleteOverviewDialogProps {
  title: string;
  onDelete: () => void;
  onClose: () => void;
}

const HEADING_ID = "DeleteOverviewDialog-heading";

export function DeleteOverviewDialog({ title, onDelete, onClose }: DeleteOverviewDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      cancel.current?.focus();
    }
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
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      data-testid={deleteOverviewDialogTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />

        <h2 className={styles.heading} id={HEADING_ID}>
          Delete this overview?
        </h2>
        <p className={styles.body} data-testid={deleteOverviewDialogTestIds.body}>
          “{title}” goes from your library, and from your other devices if you sync. It can’t be
          undone.
        </p>

        <div className={styles.foot}>
          <button
            type="button"
            ref={cancel}
            className={styles.quietAction}
            onClick={onClose}
            data-testid={deleteOverviewDialogTestIds.cancelButton}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={onDelete}
            data-testid={deleteOverviewDialogTestIds.deleteButton}
          >
            Delete overview
          </button>
        </div>
      </div>
    </dialog>
  );
}
