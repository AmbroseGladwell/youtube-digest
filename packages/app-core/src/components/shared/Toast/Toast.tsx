import { createPortal } from "react-dom";
import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./Toast.module.scss";
import { toastTestIds } from "./ToastTestIds.js";
import type { ToastMessage } from "./useToast.js";

// Design 266am: a word at the foot of the window that something was done, or couldn't be.
export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (toast === null) return null;
  return createPortal(
    <div key={toast.key} className={styles.toast} role="status" data-testid={toastTestIds.root}>
      <StrokeIcon name={toast.done ? "check" : "alertCircle"} size={17} />
      {toast.text}
    </div>,
    document.body,
  );
}
