import { useEffect, useRef } from "react";

// A line already comfortably in view is left alone, so the page doesn't jump per line.
export const useSpokenLineInView = <Element extends HTMLElement>(speaking: boolean, activeIndex: number | null) => {
  const line = useRef<Element | null>(null);
  useEffect(() => {
    const element = line.current;
    if (!speaking || activeIndex === null || element === null) {
      return;
    }
    const { top, bottom } = element.getBoundingClientRect();
    if (top >= window.innerHeight * 0.15 && bottom <= window.innerHeight * 0.7) {
      return;
    }
    element.scrollIntoView({ block: "center", behavior: "instant" });
  }, [speaking, activeIndex]);
  return line;
};
