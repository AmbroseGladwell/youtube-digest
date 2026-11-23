import { useEffect, useState, type FocusEvent, type PointerEvent } from "react";
import { useLongPressTip, type LongPressTipProps } from "./useLongPressTip.js";

export interface FloatingTipTriggerProps extends LongPressTipProps {
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: () => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
}

export interface FloatingTipState {
  shown: boolean;
  trigger: FloatingTipTriggerProps;
}

// The rules of docs/conventions/frontend-architecture-guide.md, 4.4, for a tip FloatingTip shows outside the element.
export const useFloatingTip = (enabled: boolean): FloatingTipState => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const press = useLongPressTip(enabled);
  const shown = enabled && (hovered || focused || press["data-held"] !== undefined);

  useEffect(() => {
    if (!shown) {
      return;
    }
    const hide = () => {
      setHovered(false);
      setFocused(false);
    };
    const hideOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        hide();
      }
    };
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", hideOnEscape, { capture: true });
    return () => {
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", hideOnEscape, { capture: true });
    };
  }, [shown]);

  return {
    shown,
    trigger: {
      ...press,
      onPointerEnter: (event) => setHovered(event.pointerType !== "touch"),
      onPointerLeave: () => setHovered(false),
      onFocus: (event) => setFocused(event.currentTarget.matches(":focus-visible")),
      onBlur: () => setFocused(false),
    },
  };
};
