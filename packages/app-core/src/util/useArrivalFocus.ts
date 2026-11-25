import { useEffect, type RefObject } from "react";

const MODAL = "dialog:modal";

// A sheet that led here is still modal while it leaves, so the page waits for it to go, then takes focus.
export const useArrivalFocus = (target: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const focus = () => target.current?.focus({ preventScroll: true });
    focus();
    if (document.querySelector(MODAL) === null) {
      return;
    }
    const watcher = new MutationObserver(() => {
      if (document.querySelector(MODAL) === null) {
        watcher.disconnect();
        focus();
      }
    });
    watcher.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => watcher.disconnect();
  }, [target]);
};
