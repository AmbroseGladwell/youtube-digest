import { useEffect, useRef, type RefObject } from "react";

export const MASTHEAD_HEIGHT_PROPERTY = "--masthead-height";

export interface MastheadHeightRefs {
  root: RefObject<HTMLDivElement | null>;
  masthead: RefObject<HTMLElement | null>;
}

// The masthead is sticky, and anything that sticks beneath it — the reader's tab strip —
// has to stop exactly at its lower edge. Its height isn't a constant: it wraps to two rows
// on a phone and grows a row again when the paste field is open, so it is measured from
// the laid-out element and published as a custom property rather than hardcoded per
// breakpoint (docs/features/overview-redesign.md).
export function useMastheadHeight(): MastheadHeightRefs {
  const root = useRef<HTMLDivElement | null>(null);
  const masthead = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mastheadElement = masthead.current;
    const rootElement = root.current;
    if (!mastheadElement || !rootElement) {
      return;
    }

    const publish = () =>
      rootElement.style.setProperty(MASTHEAD_HEIGHT_PROPERTY, `${mastheadElement.offsetHeight}px`);

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(mastheadElement);
    return () => observer.disconnect();
  }, []);

  return { root, masthead };
}
