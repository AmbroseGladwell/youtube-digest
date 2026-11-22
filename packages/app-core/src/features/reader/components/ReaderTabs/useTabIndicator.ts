import { useLayoutEffect, useMemo, useRef, useState, type RefCallback } from "react";
import { READER_TABS, type ReaderTab } from "../../types/ReaderTab.js";

export interface TabIndicator {
  tabRef: Record<ReaderTab, RefCallback<HTMLButtonElement>>;
  offset: number;
  width: number;
}

// Labels differ in length, so the travelling indicator is measured off the buttons, not divided out.
export const useTabIndicator = (active: ReaderTab): TabIndicator => {
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
      setBounds(element ? { offset: element.offsetLeft, width: element.offsetWidth } : { offset: 0, width: 0 });
    };

    measure();
    const observer = new ResizeObserver(measure);
    for (const element of buttons.current.values()) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [active]);

  return { tabRef, offset: bounds.offset, width: bounds.width };
};
