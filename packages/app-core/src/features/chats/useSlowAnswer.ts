import { useEffect, useState } from "react";

export const NO_WORDS_MS = 4000;
export const STALLED_MS = 6000;

export type Slowness = "noWordsYet" | "stalled" | null;

export const useSlowAnswer = (answering: boolean, text: string): Slowness => {
  const [slow, setSlow] = useState<Slowness>(null);
  useEffect(() => {
    setSlow(null);
    if (!answering) {
      return;
    }
    const timer = setTimeout(() => setSlow(text === "" ? "noWordsYet" : "stalled"), text === "" ? NO_WORDS_MS : STALLED_MS);
    return () => clearTimeout(timer);
  }, [answering, text]);
  return slow;
};
