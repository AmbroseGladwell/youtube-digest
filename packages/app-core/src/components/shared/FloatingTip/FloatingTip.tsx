import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./FloatingTip.module.scss";
import { floatingTipTestIds } from "./FloatingTipTestIds.js";

const GAP = 6;
const GUTTER = 8;

export interface FloatingTipProps {
  text: string;
  shown: boolean;
  anchor: RefObject<HTMLElement | null>;
}

interface Place {
  top: number;
  left: number;
}

interface Size {
  width: number;
  height: number;
}

export const placeTip = (anchor: DOMRect, tip: Size, screen: Size): Place => {
  const left = Math.max(GUTTER, Math.min(anchor.left, screen.width - GUTTER - tip.width));
  const below = anchor.bottom + GAP;
  const fitsBelow = below + tip.height <= screen.height - GUTTER;
  const above = anchor.top - GAP - tip.height;
  return { top: fitsBelow || above < GUTTER ? below : above, left };
};

// Hidden from screen readers: the element it names already carries the whole text.
export const FloatingTip = ({ text, shown, anchor }: FloatingTipProps) => {
  const tip = useRef<HTMLSpanElement | null>(null);
  const [place, setPlace] = useState<Place | null>(null);

  useLayoutEffect(() => {
    const anchored = anchor.current;
    const shownTip = tip.current;
    if (!shown || anchored === null || shownTip === null) {
      setPlace(null);
      return;
    }
    setPlace(
      placeTip(
        anchored.getBoundingClientRect(),
        { width: shownTip.offsetWidth, height: shownTip.offsetHeight },
        { width: document.documentElement.clientWidth, height: window.innerHeight },
      ),
    );
  }, [shown, text, anchor]);

  if (!shown) {
    return null;
  }
  return createPortal(
    <span
      ref={tip}
      className={styles.tip}
      style={place === null ? { visibility: "hidden" } : { top: place.top, left: place.left }}
      aria-hidden="true"
      data-testid={floatingTipTestIds.tip}
    >
      {text}
    </span>,
    document.body,
  );
};
