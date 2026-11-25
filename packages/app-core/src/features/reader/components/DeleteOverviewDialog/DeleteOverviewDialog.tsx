import { useRef } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import styles from "./DeleteOverviewDialog.module.scss";
import { deleteOverviewDialogTestIds } from "./DeleteOverviewDialogTestIds.js";

export interface DeleteOverviewDialogProps {
  open: boolean;
  title: string;
  onDelete: () => void;
  onClose: () => void;
}

export const DeleteOverviewDialog = ({ open, title, onDelete, onClose }: DeleteOverviewDialogProps) => {
  const cancel = useRef<HTMLButtonElement | null>(null);

  return (
    <BottomSheet
      open={open}
      title="Delete this overview?"
      onClose={onClose}
      wide="dialog"
      width="27.5rem"
      role="alertdialog"
      initialFocus={cancel}
      testId={deleteOverviewDialogTestIds.root}
      foot={
        <>
          <button
            type="button"
            ref={cancel}
            className={styles.quietAction}
            onClick={onClose}
            data-testid={deleteOverviewDialogTestIds.cancelButton}
          >
            Cancel
          </button>
          <button type="button" className={styles.primaryAction} onClick={onDelete} data-testid={deleteOverviewDialogTestIds.deleteButton}>
            Delete overview
          </button>
        </>
      }
    >
      <p className={styles.body} data-testid={deleteOverviewDialogTestIds.body}>
        “{title}” goes from your library, and from your other devices if you sync. It can’t be undone.
      </p>
    </BottomSheet>
  );
};
