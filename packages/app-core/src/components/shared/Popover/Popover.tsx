import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDismissOnOutside } from "../../../util/useDismissOnOutside.js";
import styles from "./Popover.module.scss";

export interface PopoverProps {
  anchor: RefObject<HTMLElement | null>;
  title: string;
  onClose: () => void;
  foot?: ReactNode;
  width?: number;
  role?: "dialog" | "menu";
  titleShown?: boolean;
  testId?: string;
  children: ReactNode;
}

interface Place {
  top: number;
  left: number;
  maxHeight: number;
}

const EDGE = 16;
const GAP = 8;

const placeUnder = (anchor: HTMLElement, width: number): Place => {
  const box = anchor.getBoundingClientRect();
  const fits = Math.min(width, window.innerWidth - EDGE * 2);
  const left = Math.max(EDGE, Math.min(box.right - fits, window.innerWidth - EDGE - fits));
  const top = box.bottom + GAP;
  return { top, left, maxHeight: Math.max(160, window.innerHeight - top - EDGE) };
};

// Never off screen: capped at the space below its button, the body scrolls inside (design 399o-3b).
export const Popover = ({
  anchor,
  title,
  onClose,
  foot,
  width = 384,
  role = "dialog",
  titleShown = true,
  testId,
  children,
}: PopoverProps) => {
  const root = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [overflows, setOverflows] = useState(false);
  const titleId = `${testId ?? "popover"}-title`;

  const close = () => {
    onClose();
    anchor.current?.focus();
  };
  useDismissOnOutside(true, close, root, anchor);

  useLayoutEffect(() => {
    const element = anchor.current;
    if (element === null) {
      return;
    }
    const replace = () => setPlace(placeUnder(element, width));
    replace();
    window.addEventListener("resize", replace);
    window.addEventListener("scroll", replace, true);
    return () => {
      window.removeEventListener("resize", replace);
      window.removeEventListener("scroll", replace, true);
    };
  }, [anchor, width]);

  useLayoutEffect(() => {
    const element = body.current;
    if (element === null) {
      return;
    }
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  });

  const placed = place !== null;
  useEffect(() => {
    if (!placed) {
      return;
    }
    const first = root.current?.querySelector<HTMLElement>("[aria-checked='true'], input:checked") ?? null;
    (
      first ?? root.current?.querySelector<HTMLElement>("input, button, [href], [role^='menuitem'], [tabindex]:not([tabindex='-1'])")
    )?.focus();
  }, [placed]);

  return createPortal(
    <div
      ref={root}
      className={styles.root}
      role={role}
      aria-labelledby={titleShown ? titleId : undefined}
      aria-label={titleShown ? undefined : title}
      style={place === null ? { visibility: "hidden" } : { top: place.top, left: place.left, maxHeight: place.maxHeight, width }}
      data-testid={testId}
    >
      {titleShown && (
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      )}
      <div ref={body} className={`${styles.body} ${overflows ? styles.overflows : ""}`}>
        {children}
      </div>
      {foot !== undefined && <div className={styles.foot}>{foot}</div>}
    </div>,
    document.body,
  );
};
