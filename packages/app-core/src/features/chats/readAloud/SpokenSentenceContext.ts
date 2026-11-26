import { createContext, useContext } from "react";
import type { SpokenAnswerPlace } from "@overview/domain";
import type { SpokenRange } from "../util/spokenPieces.js";
import type { SentenceOnScreen } from "./ReadAloudEngine.js";

const SpokenSentenceContext = createContext<SentenceOnScreen | null>(null);

export const SpokenSentenceProvider = SpokenSentenceContext.Provider;

const samePlace = (a: SpokenAnswerPlace, b: SpokenAnswerPlace): boolean => JSON.stringify(a) === JSON.stringify(b);

// The sentence being read, if it sits in this block of this part of the answer.
export const useSpokenRange = (place: SpokenAnswerPlace | undefined, block: number): SpokenRange | null => {
  const sentence = useContext(SpokenSentenceContext);
  if (sentence === null || place === undefined || sentence.block !== block || !samePlace(sentence.place, place)) {
    return null;
  }
  return { start: sentence.start, end: sentence.end };
};
