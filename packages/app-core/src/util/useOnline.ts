import { useSyncExternalStore } from "react";

const subscribe = (changed: () => void) => {
  window.addEventListener("online", changed);
  window.addEventListener("offline", changed);
  return () => {
    window.removeEventListener("online", changed);
    window.removeEventListener("offline", changed);
  };
};

// True where the browser can't say.
export const useOnline = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => globalThis.navigator?.onLine ?? true,
    () => true,
  );
