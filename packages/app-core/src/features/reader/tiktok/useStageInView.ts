import { useCallback, useRef, useState } from "react";

export interface StageInView {
  inView: boolean;
  stageRef: (element: HTMLElement | null) => void;
  scrollTo: () => void;
}

// Whether the player above the title is on screen, so the mini bar can stand in when it isn't (130p-3).
export const useStageInView = (): StageInView => {
  const [inView, setInView] = useState(true);
  const element = useRef<HTMLElement | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const stageRef = useCallback((next: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    element.current = next;
    if (next === null || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    observer.current = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), { threshold: 0.25 });
    observer.current.observe(next);
  }, []);
  const scrollTo = useCallback(() => element.current?.scrollIntoView({ block: "center", behavior: "smooth" }), []);
  return { inView, stageRef, scrollTo };
};
