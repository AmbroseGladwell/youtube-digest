import { useEffect, useState } from "react";

export const NO_WORDS_MS = 4000;
export const STALLED_MS = 6000;

export type Slowness = "noWordsYet" | "stalled" | null;

// Design 310an–310ao: no words four seconds after asking, or words that stop for six, each say
// so under the answer; Stop works throughout.
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
