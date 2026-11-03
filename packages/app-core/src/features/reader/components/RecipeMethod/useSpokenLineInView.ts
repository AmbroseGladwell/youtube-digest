import { useEffect, useRef } from "react";

// The line being read stays on screen while the narration is in this list, as the note's do.
// A line already comfortably in view is left alone, so the page doesn't jump per line.
export function useSpokenLineInView<Element extends HTMLElement>(speaking: boolean, activeIndex: number | null) {
  const line = useRef<Element | null>(null);
  useEffect(() => {
    const element = line.current;
    if (!speaking || activeIndex === null || element === null) return;
    const { top, bottom } = element.getBoundingClientRect();
    if (top >= window.innerHeight * 0.15 && bottom <= window.innerHeight * 0.7) return;
    element.scrollIntoView({ block: "center", behavior: "instant" });
  }, [speaking, activeIndex]);
  return line;
}
