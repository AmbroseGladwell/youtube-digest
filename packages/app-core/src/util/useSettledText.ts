import { useEffect, useState } from "react";
import { TYPING_SETTLED_MS } from "../features/analytics/useTypingSettled.js";

// The text once the reader has stopped typing, so a search that costs a request is sent
// once per burst rather than once per key.
export function useSettledText(text: string, delayMs: number = TYPING_SETTLED_MS): string {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    if (text === settled) return;
    const timer = setTimeout(() => setSettled(text), text === "" ? 0 : delayMs);
    return () => clearTimeout(timer);
  }, [text, settled, delayMs]);
  return settled;
}
