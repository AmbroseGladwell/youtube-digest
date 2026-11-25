import { useRef } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import styles from "./DeleteProjectDialog.module.scss";
import { deleteProjectDialogTestIds } from "./DeleteProjectDialogTestIds.js";

export interface DeleteProjectDialogProps {
  open: boolean;
  name: string;
  overviews: number;
  assistantConnected: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export const DeleteProjectDialog = ({ open, name, overviews, assistantConnected, onDelete, onClose }: DeleteProjectDialogProps) => {
  const cancel = useRef<HTMLButtonElement | null>(null);

  const kept =
    overviews === 0
      ? "It has no overviews in it."
      : `Its ${overviews === 1 ? "overview stays" : `${overviews} overviews stay`} in your library.`;

  return (
    <BottomSheet
      open={open}
      title={`Delete ${name}?`}
      onClose={onClose}
      wide="dialog"
      width="27.5rem"
      role="alertdialog"
      initialFocus={cancel}
      testId={deleteProjectDialogTestIds.root}
      foot={
        <>
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
        </>
      }
    >
      <p className={styles.body} data-testid={deleteProjectDialogTestIds.body}>
        {kept} The project goes from every device{assistantConnected ? ", and your assistant won’t see it again" : ""}. You can’t undo this.
        To put it away instead, archive it.
      </p>
    </BottomSheet>
  );
};
