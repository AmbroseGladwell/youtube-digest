import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";
import { useFocusTrap } from "../../../../util/useFocusTrap.js";
import { LOWERED_SHOWS_PX, resistedOffset, restAfterDrag, type SheetRest } from "../../util/sheetDrag.js";
import styles from "./ChatSheet.module.scss";
import { chatSheetTestIds } from "./ChatSheetTestIds.js";

export interface ChatSheetProps {
  // Stays mounted: it springs in when this turns true and falls away when it turns false.
  open: boolean;
  rest: SheetRest;
  label: string;
  loweredTitle: string;
  loweredLine: string;
  loweredIcon?: StrokeIconName | null;
  playing: boolean;
  underMasthead: boolean;
  onRestChange: (rest: SheetRest) => void;
  children: ReactNode;
}

const DRAG_START_PX = 4;
const LEAVE_FALLBACK_MS = 400;

const scrimOpacityOf = (travel: number, raised: boolean, offset: number): number => {
  if (travel === 0) {
    return raised ? 1 : 0;
  }
  return Math.min(1, Math.max(0, 1 - offset / travel));
};

interface Drag {
  pointerId: number;
  startY: number;
  startOffset: number;
  lastY: number;
  lastAt: number;
  velocity: number;
  moved: boolean;
}

// How the sheet moves: docs/features/chats.md, "Beside the note (design 310a, 310d–310p)".
export const ChatSheet = ({
  open,
  rest,
  label,
  loweredTitle,
  loweredLine,
  loweredIcon = null,
  playing,
  underMasthead,
  onRestChange,
  children,
}: ChatSheetProps) => {
  const sheet = useRef<HTMLDivElement | null>(null);
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [mastheadTop, setMastheadTop] = useState<string | null>(null);
  const [height, setHeight] = useState(0);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const raised = rest === "raised";
  const travel = Math.max(0, height - LOWERED_SHOWS_PX);
  const offset = dragOffset ?? (raised ? 0 : travel);

  const [leaving, setLeaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setLeaving(!open && !prefersReducedMotion());
  }

  useFocusTrap(open && raised, sheet);

  useEffect(() => {
    const element = sheet.current;
    if (!leaving || element === null) {
      return;
    }
    const timer = setTimeout(() => setLeaving(false), LEAVE_FALLBACK_MS);
    const ended = (event: AnimationEvent) => {
      if (event.target === element) {
        setLeaving(false);
      }
    };
    element.addEventListener("animationend", ended);
    return () => {
      clearTimeout(timer);
      element.removeEventListener("animationend", ended);
    };
  }, [leaving]);

  // The sheet is portalled above the app's bar, so it reads the masthead's height where it stands.
  useLayoutEffect(() => {
    if (!underMasthead || anchor.current === null) {
      return;
    }
    const height = getComputedStyle(anchor.current).getPropertyValue("--masthead-height").trim();
    setMastheadTop(height === "" ? null : height);
  }, [underMasthead]);

  useLayoutEffect(() => {
    const element = sheet.current;
    if (element === null) {
      return;
    }
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [open]);

  const start = (event: PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest("[data-sheet-grab]") === null &&
      (target.closest("[data-sheet-drag]") === null || target.closest("button") !== null)
    ) {
      return;
    }
    (event.target as Element).setPointerCapture?.(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: offset,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (current === null || event.pointerId !== current.pointerId) {
      return;
    }
    const delta = event.clientY - current.startY;
    if (!current.moved && Math.abs(delta) < DRAG_START_PX) {
      return;
    }
    const elapsed = Math.max(1, event.timeStamp - current.lastAt);
    drag.current = {
      ...current,
      moved: true,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      velocity: (event.clientY - current.lastY) / elapsed,
    };
    setDragOffset(resistedOffset(current.startOffset + delta, travel));
  };

  const end = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (current === null || event.pointerId !== current.pointerId) {
      return;
    }
    drag.current = null;
    justDragged.current = current.moved;
    if (current.moved) {
      onRestChange(restAfterDrag(resistedOffset(current.startOffset + event.clientY - current.startY, travel), travel, current.velocity));
    }
    setDragOffset(null);
  };

  const scrim = scrimOpacityOf(travel, raised, offset);

  if (!open && !leaving) {
    return <span ref={anchor} hidden />;
  }

  return (
    <>
      <span ref={anchor} hidden />
      {createPortal(
        <>
          <div
            className={`${styles.scrim} ${leaving ? styles.leaving : ""}`}
            style={{ opacity: scrim, pointerEvents: raised && !leaving ? "auto" : "none" } as CSSProperties}
            onClick={() => onRestChange("lowered")}
            aria-hidden="true"
            data-testid={chatSheetTestIds.scrim}
          />
          <div
            ref={sheet}
            className={[
              styles.sheet,
              dragOffset !== null || prefersReducedMotion() ? styles.following : "",
              dragOffset !== null ? styles.dragging : "",
              leaving ? styles.leaving : "",
            ].join(" ")}
            style={
              {
                transform: `translateY(${offset}px)`,
                ...(mastheadTop === null ? {} : { "--chat-sheet-top": mastheadTop }),
              } as CSSProperties
            }
            role="dialog"
            aria-modal={raised}
            inert={leaving}
            aria-label={label}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            data-rest={rest}
            data-testid={chatSheetTestIds.root}
          >
            <button
              type="button"
              className={styles.grab}
              aria-label={raised ? "Lower chat" : "Raise chat"}
              onClick={() => {
                if (justDragged.current) {
                  justDragged.current = false;
                  return;
                }
                onRestChange(raised ? "lowered" : "raised");
              }}
              data-sheet-grab
              data-testid={chatSheetTestIds.grab}
            />
            {!raised && (
              <div className={styles.lowered} data-testid={chatSheetTestIds.lowered}>
                <div className={styles.loweredText}>
                  <p className={styles.loweredTitle}>{loweredTitle}</p>
                  <p className={styles.loweredLine} data-testid={chatSheetTestIds.loweredLine}>
                    {loweredIcon !== null && <StrokeIcon name={loweredIcon} size={14} />}
                    {loweredLine}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.raise}
                  aria-label={playing ? "Back to the conversation" : "Raise chat"}
                  onClick={() => onRestChange("raised")}
                  data-testid={chatSheetTestIds.raise}
                >
                  <StrokeIcon name="chevronUp" size={18} />
                </button>
              </div>
            )}
            <div className={styles.content} inert={!raised}>
              {children}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
};
