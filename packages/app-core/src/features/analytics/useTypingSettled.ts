import { useCallback, useEffect, useRef } from "react";

export const TYPING_SETTLED_MS = 1_000;

// One event for a burst of typing, once the reader stops, and nothing for what the field
// started with: what is counted is that they typed, never what (docs/architecture/analytics.md,
// "Typing"). send is read when it fires, so it can say what the typing found. A form that
// submits the text calls the returned settle first, so typing cut short by the submit is still
// counted, and counted before what the submit sends (OV-93).
export function useTypingSettled(text: string, send: () => void, delayMs: number = TYPING_SETTLED_MS): () => void {
  const latest = useRef(send);
  latest.current = send;
  const initial = useRef(text);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text === initial.current || text.trim() === "") return;
    const timer = setTimeout(() => {
      pending.current = null;
      latest.current();
    }, delayMs);
    pending.current = timer;
    return () => {
      clearTimeout(timer);
      if (pending.current === timer) pending.current = null;
    };
  }, [text, delayMs]);

  return useCallback(() => {
    if (pending.current === null) return;
    clearTimeout(pending.current);
    pending.current = null;
    latest.current();
  }, []);
}
