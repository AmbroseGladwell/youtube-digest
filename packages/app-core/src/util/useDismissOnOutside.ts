import { useEffect, useRef, type RefObject } from "react";

type InsideRef = RefObject<HTMLElement | null>;

// Escape, or a pointer down on anything that is not one of the given elements. More than
// one element because a control can have a part that renders outside its own subtree —
// the topic line's picker portals to the body on a phone
// (docs/features/topic-filing.md).
//
// The handler is read back through a ref rather than taken as a dependency, so the
// listeners are attached once per opening instead of on every render, and still can never
// be the close() of an earlier one.
export function useDismissOnOutside(
  active: boolean,
  dismiss: () => void,
  ...insideRefs: InsideRef[]
): void {
  const latest = useRef({ dismiss, insideRefs });
  latest.current = { dismiss, insideRefs };

  useEffect(() => {
    if (!active) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        latest.current.dismiss();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!latest.current.insideRefs.some((ref) => ref.current?.contains(target))) {
        latest.current.dismiss();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [active]);
}
