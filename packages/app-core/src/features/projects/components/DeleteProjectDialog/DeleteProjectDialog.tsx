import { useEffect, useId, useRef } from "react";
import styles from "./DeleteProjectDialog.module.scss";
import { deleteProjectDialogTestIds } from "./DeleteProjectDialogTestIds.js";

export interface DeleteProjectDialogProps {
  name: string;
  overviews: number;
  assistantConnected: boolean;
  onDelete: () => void;
  onClose: () => void;
}

// Overviews stay, the assistant loses the brief, and archiving is offered instead; Cancel
// takes the focus ("OV-168 3 Adding and Making" 168z).
export function DeleteProjectDialog({ name, overviews, assistantConnected, onDelete, onClose }: DeleteProjectDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      cancel.current?.focus();
    }
  }, []);

  const kept =
    overviews === 0
      ? "It has no overviews in it."
      : `Its ${overviews === 1 ? "overview stays" : `${overviews} overviews stay`} in your library.`;

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
      data-testid={deleteProjectDialogTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 className={styles.heading} id={headingId}>
          Delete {name}?
        </h2>
        <p className={styles.body} data-testid={deleteProjectDialogTestIds.body}>
          {kept} The project goes from every device{assistantConnected ? ", and your assistant won’t see it again" : ""}. You can’t undo
          this. To put it away instead, archive it.
        </p>
        <div className={styles.foot}>
          <button
            type="button"
            ref={cancel}
            className={styles.quietAction}
            onClick={onClose}
            data-testid={deleteProjectDialogTestIds.cancelButton}
          >
            Cancel
          </button>
          <button type="button" className={styles.primaryAction} onClick={onDelete} data-testid={deleteProjectDialogTestIds.deleteButton}>
            Delete project
          </button>
        </div>
      </div>
    </dialog>
  );
}
