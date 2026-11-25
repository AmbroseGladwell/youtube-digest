import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import styles from "./RegenerateArticleDialog.module.scss";
import { regenerateArticleDialogTestIds } from "./RegenerateArticleDialogTestIds.js";

export interface RegenerateArticleDialogProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

// We keep no copy of an article, so regenerating one needs it open beside the panel.
export const RegenerateArticleDialog = ({ open, url, onClose }: RegenerateArticleDialogProps) => (
  <BottomSheet
    open={open}
    title="Regenerating reads the article again"
    onClose={onClose}
    wide="dialog"
    width="27.5rem"
    testId={regenerateArticleDialogTestIds.root}
    foot={
      <>
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
      </>
    }
  >
    <p className={styles.body}>
      We don’t keep a copy of it, so it needs to be open in Chrome. Open it, then press Regenerate in the side panel. Your current overview
      stays until the new one is ready.
    </p>
  </BottomSheet>
);
