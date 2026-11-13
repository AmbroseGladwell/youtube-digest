import { useEffect, useId, useRef } from "react";
import styles from "./DeleteOverviewsDialog.module.scss";
import { deleteOverviewsDialogTestIds } from "./DeleteOverviewsDialogTestIds.js";

export interface DeleteOverviewsDialogProps {
  count: number;
  onDelete: () => void;
  onClose: () => void;
}

// Always asks, names the count, and says they leave their projects too; Cancel takes the
// focus ("OV-168 5" 168at).
export function DeleteOverviewsDialog({ count, onDelete, onClose }: DeleteOverviewsDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();
  const noun = count === 1 ? "overview" : `${count} overviews`;

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
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      data-testid={deleteOverviewsDialogTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 className={styles.heading} id={headingId}>
          Delete {count === 1 ? "this overview" : noun}?
        </h2>
        <p className={styles.body} data-testid={deleteOverviewsDialogTestIds.body}>
          {count === 1 ? "It goes" : "They go"} from your library on every device, and from any projects {count === 1 ? "it’s" : "they’re"}{" "}
          in. You can’t undo this.
        </p>
        <div className={styles.foot}>
          <button
            type="button"
            ref={cancel}
            className={styles.quietAction}
            onClick={onClose}
            data-testid={deleteOverviewsDialogTestIds.cancelButton}
          >
            Cancel
          </button>
          <button type="button" className={styles.primaryAction} onClick={onDelete} data-testid={deleteOverviewsDialogTestIds.deleteButton}>
            Delete {noun}
          </button>
        </div>
      </div>
    </dialog>
  );
}
