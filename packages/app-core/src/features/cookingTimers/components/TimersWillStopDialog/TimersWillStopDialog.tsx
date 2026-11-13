import { useEffect, useRef } from "react";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import styles from "./TimersWillStopDialog.module.scss";
import { timersWillStopDialogTestIds } from "./TimersWillStopDialogTestIds.js";

export interface TimersWillStopCopy {
  sentence: string;
  stay: string;
  go: string;
}

export interface TimersWillStopDialogProps {
  open: boolean;
  heading: string;
  copy: TimersWillStopCopy | null;
  onStay: () => void;
  onGo: () => void;
}

// Designs 288ae–288ag: going somewhere that stops the timers warns first. Staying is filled and
// focused, and Esc means it; going on stops them. A sheet on a phone, a dialog on the web.
export function TimersWillStopDialog({ open, heading, copy, onStay, onGo }: TimersWillStopDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const stay = useRef<HTMLButtonElement | null>(null);
  const web = !useIsPhone() && !useIsPanel();

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) {
      element.showModal();
      stay.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${web ? styles.web : ""}`}
      role="alertdialog"
      aria-label={heading}
      onCancel={(event) => {
        event.preventDefault();
        onStay();
      }}
      data-testid={timersWillStopDialogTestIds.root}
    >
      {open && copy !== null && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          <h2 className={styles.heading} data-testid={timersWillStopDialogTestIds.heading}>
            {heading}
          </h2>
          <p className={styles.sentence} data-testid={timersWillStopDialogTestIds.sentence}>
            {copy.sentence}
          </p>
          <div className={styles.buttons}>
            <button type="button" ref={stay} className={styles.stay} onClick={onStay} data-testid={timersWillStopDialogTestIds.stay}>
              {copy.stay}
              {web && <kbd className={styles.key}>Esc</kbd>}
            </button>
            <button type="button" className={styles.go} onClick={onGo} data-testid={timersWillStopDialogTestIds.go}>
              {copy.go}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
