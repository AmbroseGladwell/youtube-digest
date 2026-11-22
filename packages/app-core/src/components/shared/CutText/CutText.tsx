import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./CutText.module.scss";
import { cutTextTestIds } from "./CutTextTestIds.js";

const LONG_PRESS_MS = 500;

export interface CutTextProps {
  text: string;
  // The caller's own line styles, which cut the text with an ellipsis or a line clamp.
  className: string | undefined;
  testId?: string;
}

// Text cut to its lines shows the whole of it in a tip: on hover or keyboard focus with a mouse,
// and only while pressed and held on touch, where the press doesn't then count as a tap (OV-371).
// The text is already in the page, so the tip is hidden from screen readers.
export const CutText = ({ text, className, testId }: CutTextProps) => {
  const element = useRef<HTMLSpanElement | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cut, setCut] = useState(false);
  const [held, setHeld] = useState(false);
  const heldNow = useRef(false);

  useLayoutEffect(() => {
    const shown = element.current;
    if (shown === null) {
      return;
    }
    const measure = () => setCut(shown.scrollWidth > shown.clientWidth + 1 || shown.scrollHeight > shown.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shown);
    return () => observer.disconnect();
  }, [text]);

  useEffect(() => () => clearPress(), []);

  const clearPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
    }
    pressTimer.current = null;
  };

  const startPress = () => {
    heldNow.current = false;
    if (!cut) {
      return;
    }
    clearPress();
    pressTimer.current = setTimeout(() => {
      heldNow.current = true;
      setHeld(true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    clearPress();
    setHeld(false);
  };

  // The tap that ends a long press would otherwise open what holds the text.
  const swallowHeldClick = (event: MouseEvent) => {
    if (!heldNow.current) {
      return;
    }
    heldNow.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <span
      className={`${styles.wrap} ${held ? styles.held : ""}`}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      onTouchCancel={endPress}
      onClickCapture={swallowHeldClick}
      onContextMenu={(event) => {
        if (cut) {
          event.preventDefault();
        }
      }}
    >
      <span ref={element} className={className} data-testid={testId}>
        {text}
      </span>
      {cut && (
        <span className={styles.tip} aria-hidden="true" data-testid={cutTextTestIds.tip}>
          {text}
        </span>
      )}
    </span>
  );
};
