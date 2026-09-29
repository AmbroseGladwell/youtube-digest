import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// A sheet that covers the page has to hold the keyboard too: tabbing past its last
// control otherwise walks into the library behind it, where the reader can see nothing
// of where they are. Tab and Shift+Tab wrap inside the sheet while it is open, and
// closing it hands focus back to whatever opened it
// (docs/features/stone-theme.md, "The filter sheet").
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || container === null) {
      return;
    }

    const opener = document.activeElement as HTMLElement | null;
    // Read afresh on every Tab: the sheet's own controls change as filters are applied,
    // and a list that has grown or shrunk would otherwise wrap at the wrong element.
    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetWidth > 0 || element.offsetHeight > 0,
      );

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      const focused = document.activeElement;
      if (focused === null || !container.contains(focused)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      opener?.focus();
    };
  }, [active, containerRef]);
}
