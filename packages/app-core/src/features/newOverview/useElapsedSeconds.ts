import { useEffect, useState } from "react";

// Measured from the clock, never estimated — docs/prototype/constraints.md. It lives in
// the two components that print it rather than in the run itself, so a generation ticking
// once a second doesn't re-render the whole shell with it.
export function useElapsedSeconds(startedAt: number, finishedAt: number | null): number {
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
}
