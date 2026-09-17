import { useLayoutEffect, useMemo, useRef, useState, type RefCallback } from "react";
import { READER_TABS, type ReaderTab } from "../../types/ReaderTab.js";

export interface TabIndicator {
  tabRef: Record<ReaderTab, RefCallback<HTMLButtonElement>>;
  offset: number;
  width: number;
}

// Design 9b is one indicator that travels, not three that switch on, so it has to know
// where the active label actually is. The three labels are words of different lengths, so
// the offset is measured off the laid-out buttons rather than divided out of the strip's
// width — docs/prototype/constraints.md's rule that nothing estimates a number it could
// read. The layout effect puts the measurement in before the first paint, and the ref
// callbacks are built once so React never detaches a button between renders.
export function useTabIndicator(active: ReaderTab): TabIndicator {
  const buttons = useRef(new Map<ReaderTab, HTMLButtonElement>());
  const [bounds, setBounds] = useState({ offset: 0, width: 0 });

  const tabRef = useMemo(() => {
    const refs = {} as Record<ReaderTab, RefCallback<HTMLButtonElement>>;
    for (const tab of READER_TABS) {
      refs[tab] = (element) => {
        if (element) {
          buttons.current.set(tab, element);
        } else {
          buttons.current.delete(tab);
        }
      };
    }
    return refs;
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const element = buttons.current.get(active);
      setBounds(
        element ? { offset: element.offsetLeft, width: element.offsetWidth } : { offset: 0, width: 0 },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    for (const element of buttons.current.values()) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [active]);

  return { tabRef, offset: bounds.offset, width: bounds.width };
}
