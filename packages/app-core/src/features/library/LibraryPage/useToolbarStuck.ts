import { useEffect, useRef, useState } from "react";

const HELD_BY = 1;

export const useToolbarStuck = (enabled: boolean) => {
  const sentinel = useRef<HTMLDivElement | null>(null);
  const toolbar = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setStuck(false);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const above = sentinel.current?.getBoundingClientRect().bottom;
      const bar = toolbar.current?.getBoundingClientRect().top;
      setStuck(above !== undefined && bar !== undefined && bar - above > HELD_BY);
    };
    const schedule = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);

  return { sentinel, toolbar, stuck };
};
