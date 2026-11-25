import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion } from "../../../util/prefersReducedMotion.js";
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
  // Replaces the title's heading with the sheet's own; the title still names the dialog. Null leaves the head to the body.
  head?: ReactNode;
  // The id of a heading in the body that names the dialog, for a sheet whose heading changes with its steps.
  labelledBy?: string;
  // False while nothing may close it: no ×, and Escape, the backdrop and the handle do nothing.
  dismissible?: boolean;
  // Escape steps back a level here, where × still closes the whole sheet.
  onEscape?: () => void;
  foot?: ReactNode;
  // From 48rem: "sheet" stays a sheet (its owner shows something else there), "dialog" is a centred card.
  wide?: "sheet" | "dialog";
  width?: string | undefined;
  role?: "dialog" | "alertdialog";
  initialFocus?: RefObject<HTMLElement | null>;
  // Where focus goes once it has closed; otherwise whatever had it when it opened.
  returnFocusTo?: HTMLElement | null | undefined;
  testId?: string;
  children: ReactNode;
}

interface Drag {
  startY: number;
  startedAt: number;
  height: number;
}

export const NARROW_SHEET_WIDTH = "28.75rem";

const FLICK = 0.6;
const GROW = 40;
const LEAVE_FALLBACK_MS = 400;
const WIDE_QUERY = "(min-width: 48rem)";

const isCentred = (wide: BottomSheetProps["wide"]) => wide === "dialog" && window.matchMedia(WIDE_QUERY).matches;

// Every bottom sheet, one behaviour: docs/features/bottom-sheets.md.
export const BottomSheet = ({
  open,
  title,
  onClose,
  closeLabel = "Close",
  onBack,
  head,
  labelledBy,
  dismissible = true,
  onEscape,
  foot,
  wide = "sheet",
  width,
  role = "dialog",
  initialFocus,
  returnFocusTo,
  testId,
  children,
}: BottomSheetProps) => {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [full, setFull] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const latestReturn = useRef(returnFocusTo);
  latestReturn.current = returnFocusTo;
  const titleId = `${testId ?? "sheet"}-title`;
  useFocusTrap(open, panel);

  if (open && leaving) {
    setLeaving(false);
  }
  if (!open && !leaving && dialog.current?.open) {
    setLeaving(true);
  }

  useEffect(() => {
    const element = dialog.current;
    if (element === null || !open || element.open) {
      return;
    }
    setFull(false);
    setOffset(0);
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    initialFocus?.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!leaving) {
      return;
    }
    const finish = () => {
      const focused = document.activeElement;
      const stillOurs = focused === null || focused === document.body || dialog.current?.contains(focused) === true;
      dialog.current?.close();
      setLeaving(false);
      const back = latestReturn.current ?? opener.current;
      if (stillOurs && back?.isConnected) {
        back.focus({ preventScroll: true });
      }
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    const timer = setTimeout(finish, LEAVE_FALLBACK_MS);
    const element = panel.current;
    const ended = (event: AnimationEvent) => {
      if (event.target === element) {
        finish();
      }
    };
    element?.addEventListener("animationend", ended);
    return () => {
      clearTimeout(timer);
      element?.removeEventListener("animationend", ended);
    };
  }, [leaving]);

  if (!open && !leaving) {
    return null;
  }

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button") !== null || isCentred(wide) || !dismissible) {
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

  const panelStyle: CSSProperties = {
    ...(width === undefined ? {} : { "--sheet-width": width }),
    ...(offset === 0 ? {} : { transform: `translateY(${offset}px)` }),
  } as CSSProperties;

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${wide === "dialog" ? styles.centred : ""} ${leaving ? styles.leaving : ""}`}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={labelledBy ?? (head === undefined ? titleId : undefined)}
      aria-label={labelledBy === undefined && head !== undefined ? title : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) {
          (onEscape ?? onClose)();
        }
      }}
      onClick={(event) => {
        if (event.target === dialog.current && dismissible) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
        }
      }}
      data-testid={testId}
    >
      <div
        ref={panel}
        className={`${styles.panel} ${full ? styles.full : ""} ${dragging ? styles.dragging : ""}`}
        style={panelStyle}
        inert={leaving}
        data-testid={bottomSheetTestIds.panel}
      >
        <div
          className={styles.grip}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          data-testid={bottomSheetTestIds.handle}
        >
          <span className={styles.handle} aria-hidden="true" data-testid={bottomSheetTestIds.bar} />
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
            {head === undefined ? (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            ) : (
              <div className={styles.ownHead}>{head}</div>
            )}
            {dismissible && (
              <button
                type="button"
                className={styles.round}
                onClick={onClose}
                aria-label={closeLabel}
                data-testid={bottomSheetTestIds.close}
              >
                <StrokeIcon name="close" size={18} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.body}>{children}</div>
        {foot !== undefined && <div className={styles.foot}>{foot}</div>}
      </div>
    </dialog>
  );
};
