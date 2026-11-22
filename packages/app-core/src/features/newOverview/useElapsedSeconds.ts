import { useEffect, useState } from "react";

// Lives in the components that print it, not the run, so the shell doesn't re-render every second.
export const useElapsedSeconds = (startedAt: number, finishedAt: number | null): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finishedAt !== null) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, finishedAt]);

  return Math.max(0, ((finishedAt ?? now) - startedAt) / 1000);
};
