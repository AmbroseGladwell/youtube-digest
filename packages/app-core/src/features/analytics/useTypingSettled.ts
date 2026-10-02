import { useEffect, useRef } from "react";

export const TYPING_SETTLED_MS = 1_000;

// One event for a burst of typing, once the reader stops, and nothing for what the field
// started with: what is counted is that they typed, never what (docs/architecture/analytics.md,
// "Typing"). send is read when it fires, so it can say what the typing found.
export function useTypingSettled(text: string, send: () => void, delayMs: number = TYPING_SETTLED_MS): void {
  const latest = useRef(send);
  latest.current = send;
  const initial = useRef(text);

  useEffect(() => {
    if (text === initial.current || text.trim() === "") return;
    const timer = setTimeout(() => latest.current(), delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);
}
