import { useCallback, useEffect, useRef } from "react";

export const TYPING_SETTLED_MS = 1_000;

// Why a submit settles first: docs/architecture/analytics.md, "Typing".
export const useTypingSettled = (text: string, send: () => void, delayMs: number = TYPING_SETTLED_MS): (() => void) => {
  const latest = useRef(send);
  latest.current = send;
  const initial = useRef(text);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text === initial.current || text.trim() === "") {
      return;
    }
    const timer = setTimeout(() => {
      pending.current = null;
      latest.current();
    }, delayMs);
    pending.current = timer;
    return () => {
      clearTimeout(timer);
      if (pending.current === timer) {
        pending.current = null;
      }
    };
  }, [text, delayMs]);

  return useCallback(() => {
    if (pending.current === null) {
      return;
    }
    clearTimeout(pending.current);
    pending.current = null;
    latest.current();
  }, []);
};
