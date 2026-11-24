import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const MARGIN = 12;

export interface MenuRoom {
  below: boolean;
  style: CSSProperties;
}

const clips = (element: Element) => {
  const style = getComputedStyle(element);
  return style.overflowY !== "visible" || style.overflowX !== "visible";
};

const edgesAround = (anchor: HTMLElement) => {
  let top = Math.max(0, document.querySelector("header")?.getBoundingClientRect().bottom ?? 0);
  let bottom = window.innerHeight;
  for (let box = anchor.parentElement; box !== null && box !== document.body; box = box.parentElement) {
    if (clips(box)) {
      const rect = box.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
  }
  return { top, bottom };
};

export const useMenuRoom = (open: boolean, anchor: RefObject<HTMLElement | null>, wanted: number): MenuRoom => {
  const [room, setRoom] = useState({ below: false, height: Number.POSITIVE_INFINITY });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const measure = () => {
      const element = anchor.current;
      if (element === null) {
        return;
      }
      const box = element.getBoundingClientRect();
      const edges = edgesAround(element);
      const above = box.top - edges.top - MARGIN;
      const under = edges.bottom - box.bottom - MARGIN;
      const below = above < Math.min(wanted, window.innerHeight * 0.5) && under > above;
      setRoom({ below, height: Math.max(0, below ? under : above) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, anchor, wanted]);

  return {
    below: room.below,
    style: Number.isFinite(room.height) ? ({ "--menu-room": `${room.height}px` } as CSSProperties) : {},
  };
};
