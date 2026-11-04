import { useEffect, useState } from "react";

// Holds a screen wake lock while `wanted`, asking again when the page comes back into view (the
// browser drops it when hidden). True only while the browser actually holds it, so a line that
// says so is never shown where it can't (design 150v).
export function useScreenAwake(wanted: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const wakeLock = typeof navigator === "undefined" ? undefined : navigator.wakeLock;
    if (!wanted || wakeLock === undefined) {
      setHeld(false);
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;
    const ask = () => {
      if (document.visibilityState !== "visible" || (sentinel !== null && !sentinel.released)) return;
      wakeLock
        .request("screen")
        .then((granted) => {
          if (stopped) {
            void granted.release();
            return;
          }
          sentinel = granted;
          setHeld(true);
          granted.addEventListener("release", () => {
            if (!stopped) setHeld(false);
          });
        })
        .catch(() => setHeld(false));
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", ask);
      void sentinel?.release();
      setHeld(false);
    };
  }, [wanted]);

  return held;
}
