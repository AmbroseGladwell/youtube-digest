import { useEffect, useState } from "react";

// Asks again when the page comes back into view, because the browser drops the lock when hidden.
export const useScreenAwake = (wanted: boolean): boolean => {
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
      if (document.visibilityState !== "visible" || (sentinel !== null && !sentinel.released)) {
        return;
      }
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
            if (!stopped) {
              setHeld(false);
            }
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
};
