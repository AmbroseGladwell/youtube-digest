import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useFocusTrap } from "../../../util/useFocusTrap.js";
import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./BottomSheet.module.scss";
import { bottomSheetTestIds } from "./BottomSheetTestIds.js";

export interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  onBack?: () => void;
  foot?: ReactNode;
  testId?: string;
  children: ReactNode;
}

interface Drag {
  startY: number;
  startedAt: number;
  height: number;
}

const FLICK = 0.6;
const GROW = 40;

// Every bottom sheet: × and Escape close it, and the handle drags it down to close or up to full height (design 399o-15, 399o-16).
export const BottomSheet = ({ open, title, onClose, closeLabel = "Close", onBack, foot, testId, children }: BottomSheetProps) => {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [full, setFull] = useState(false);
  const [dragging, setDragging] = useState(false);
  const titleId = `${testId ?? "sheet"}-title`;
  useFocusTrap(open, panel);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setFull(false);
      setOffset(0);
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button") !== null) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startedAt: event.timeStamp, height: panel.current?.offsetHeight ?? 0 };
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== null) {
      setOffset(Math.max(event.clientY - drag.current.startY, full ? 0 : -GROW * 2));
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const started = drag.current;
    drag.current = null;
    setDragging(false);
    if (started === null) {
      return;
    }
    const moved = event.clientY - started.startY;
    const speed = moved / Math.max(1, event.timeStamp - started.startedAt);
    setOffset(0);
    if (moved > started.height / 2 || speed > FLICK) {
      onClose();
    } else if (moved < -GROW) {
      setFull(true);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      data-testid={testId}
    >
      <div
        ref={panel}
        className={`${styles.panel} ${full ? styles.full : ""} ${dragging ? styles.dragging : ""}`}
        style={offset === 0 ? undefined : { transform: `translateY(${offset}px)` }}
      >
        <div
          className={styles.grip}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          data-testid={bottomSheetTestIds.handle}
        >
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.head}>
            {onBack !== undefined && (
              <button
                type="button"
                className={styles.round}
                onClick={onBack}
                aria-label={`Back to ${title}`}
                data-testid={bottomSheetTestIds.back}
              >
                <StrokeIcon name="arrowLeft" size={18} />
              </button>
            )}
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.round} onClick={onClose} aria-label={closeLabel} data-testid={bottomSheetTestIds.close}>
              <StrokeIcon name="close" size={18} />
            </button>
          </div>
        </div>
        <div className={styles.body}>{children}</div>
        {foot !== undefined && <div className={styles.foot}>{foot}</div>}
      </div>
    </dialog>
  );
};
