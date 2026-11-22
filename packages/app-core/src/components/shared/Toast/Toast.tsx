import { createPortal } from "react-dom";
import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./Toast.module.scss";
import { toastTestIds } from "./ToastTestIds.js";
import type { ToastMessage } from "./useToast.js";

// Design 266am: a word at the foot of the window that something was done, or couldn't be,
// with Undo where it can be taken back ("OV-318 3" 318m).
export const Toast = ({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss?: () => void }) => {
  if (toast === null) {
    return null;
  }
  const { undo } = toast;
  return createPortal(
    <div key={toast.key} className={styles.toast} role="status" data-testid={toastTestIds.root}>
      <StrokeIcon name={toast.done ? "check" : "alertCircle"} size={17} />
      <span>{toast.text}</span>
      {undo !== null && (
        <button
          type="button"
          className={styles.undo}
          onClick={() => {
            undo();
            onDismiss?.();
          }}
          data-testid={toastTestIds.undoButton}
        >
          Undo
        </button>
      )}
    </div>,
    document.body,
  );
};
