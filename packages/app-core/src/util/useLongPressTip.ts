import { useEffect, useRef, useState, type MouseEvent } from "react";

const LONG_PRESS_MS = 500;

export interface LongPressTipProps {
  "data-held": "" | undefined;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onTouchCancel: () => void;
  onClickCapture: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
}

// Spread on the element theme/tip.scss's `shows` is included on: docs/conventions/frontend-architecture-guide.md, 4.4.
export const useLongPressTip = (enabled = true): LongPressTipProps => {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [held, setHeld] = useState(false);
  const heldNow = useRef(false);

  const clearPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
    }
    pressTimer.current = null;
  };

  useEffect(() => () => clearPress(), []);

  const endPress = () => {
    clearPress();
    setHeld(false);
  };

  return {
    "data-held": held ? "" : undefined,
    onTouchStart: () => {
      heldNow.current = false;
      if (!enabled) {
        return;
      }
      clearPress();
      pressTimer.current = setTimeout(() => {
        heldNow.current = true;
        setHeld(true);
      }, LONG_PRESS_MS);
    },
    onTouchEnd: endPress,
    onTouchMove: endPress,
    onTouchCancel: endPress,
    onClickCapture: (event) => {
      if (!heldNow.current) {
        return;
      }
      heldNow.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu: (event) => {
      if (enabled) {
        event.preventDefault();
      }
    },
  };
};
