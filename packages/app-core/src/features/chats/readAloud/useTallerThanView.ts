import { useEffect, useState, type RefObject } from "react";

const scrollerOf = (element: HTMLElement): HTMLElement | null => {
  for (let at = element.parentElement; at !== null; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if (overflowY === "auto" || overflowY === "scroll") {
      return at;
    }
  }
  return null;
};

// Taller than the chat's visible area at this width and zoom, so its row starts out of sight (design 418c).
export const useTallerThanView = (ref: RefObject<HTMLElement | null>): boolean => {
  const [taller, setTaller] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === "undefined") {
      return;
    }
    const scroller = scrollerOf(element);
    const measure = () => setTaller(element.offsetHeight > (scroller?.clientHeight ?? globalThis.innerHeight));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (scroller !== null) {
      observer.observe(scroller);
    }
    measure();
    return () => observer.disconnect();
  }, [ref]);
  return taller;
};
