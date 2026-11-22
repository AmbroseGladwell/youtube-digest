import { useEffect, useRef, type RefObject } from "react";

type InsideRef = RefObject<HTMLElement | null>;

// Several refs, because part of a control can portal out of its own subtree.
export const useDismissOnOutside = (active: boolean, dismiss: () => void, ...insideRefs: InsideRef[]): void => {
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
};
