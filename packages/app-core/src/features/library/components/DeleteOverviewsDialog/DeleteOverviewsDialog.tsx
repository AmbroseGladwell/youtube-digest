import { useRef } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import styles from "./DeleteOverviewsDialog.module.scss";
import { deleteOverviewsDialogTestIds } from "./DeleteOverviewsDialogTestIds.js";

export interface DeleteOverviewsDialogProps {
  open: boolean;
  returnFocusTo?: HTMLElement | null | undefined;
  count: number;
  onDelete: () => void;
  onClose: () => void;
}

export const DeleteOverviewsDialog = ({ open, returnFocusTo, count, onDelete, onClose }: DeleteOverviewsDialogProps) => {
  const cancel = useRef<HTMLButtonElement | null>(null);
  const noun = count === 1 ? "overview" : `${count} overviews`;

  return (
    <BottomSheet
      open={open}
      title={`Delete ${count === 1 ? "this overview" : noun}?`}
      onClose={onClose}
      wide="dialog"
      width="27.5rem"
      role="alertdialog"
      initialFocus={cancel}
      returnFocusTo={returnFocusTo}
      testId={deleteOverviewsDialogTestIds.root}
      foot={
        <>
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
        </>
      }
    >
      <p className={styles.body} data-testid={deleteOverviewsDialogTestIds.body}>
        {count === 1 ? "It goes" : "They go"} from your library on every device, and from any projects {count === 1 ? "it’s" : "they’re"}{" "}
        in. You can’t undo this.
      </p>
    </BottomSheet>
  );
};
