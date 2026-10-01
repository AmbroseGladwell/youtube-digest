import { useEffect, useRef, useState } from "react";

export type SavedMomentPhase = "hidden" | "shown" | "leaving";

const LEAVE_MS = 200;

// When the "Saved you" chip is on screen. On a row it leaves by itself after a few seconds;
// in an overview it stays until the page goes (docs/features/time-saved.md, "Every day").
export function useSavedMoment(autoHideMs: number | null) {
  const [phase, setPhase] = useState<SavedMomentPhase>("hidden");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const leave = () => {
    clear();
    setPhase((current) => (current === "hidden" ? current : "leaving"));
    timers.current.push(setTimeout(() => setPhase("hidden"), LEAVE_MS));
  };

  useEffect(() => clear, []);

  return {
    phase,
    show: () => {
      clear();
      setPhase("shown");
      if (autoHideMs !== null) {
        timers.current.push(setTimeout(leave, autoHideMs));
      }
    },
    hide: leave,
    reset: () => {
      clear();
      setPhase("hidden");
    },
  };
}
