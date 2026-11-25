import { useRef } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { useKeptWhileClosing } from "../../../../util/useKeptWhileClosing.js";
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

export const TimersWillStopDialog = ({ open, heading, copy, onStay, onGo }: TimersWillStopDialogProps) => {
  const stay = useRef<HTMLButtonElement | null>(null);
  const web = !useIsPhone() && !useIsPanel();
  const shown = useKeptWhileClosing(open ? copy : null);
  const kept = shown.kept;

  return (
    <BottomSheet
      open={shown.open}
      title={heading}
      onClose={onStay}
      closeLabel={kept?.stay ?? "Close"}
      wide="dialog"
      role="alertdialog"
      initialFocus={stay}
      testId={timersWillStopDialogTestIds.root}
      head={
        <h2 className={styles.heading} data-testid={timersWillStopDialogTestIds.heading}>
          {heading}
        </h2>
      }
      foot={
        kept !== null && (
          <div className={styles.buttons}>
            <button type="button" ref={stay} className={styles.stay} onClick={onStay} data-testid={timersWillStopDialogTestIds.stay}>
              {kept.stay}
              {web && <kbd className={styles.key}>Esc</kbd>}
            </button>
            <button type="button" className={styles.go} onClick={onGo} data-testid={timersWillStopDialogTestIds.go}>
              {kept.go}
            </button>
          </div>
        )
      }
    >
      {kept !== null && (
        <p className={styles.sentence} data-testid={timersWillStopDialogTestIds.sentence}>
          {kept.sentence}
        </p>
      )}
    </BottomSheet>
  );
};
